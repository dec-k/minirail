<script lang="ts">
	import {
		grid,
		getPiece,
		placePiece,
		rotateAt,
		removeAt,
		toggleAt,
		drawPath,
		toggleStationAt
	} from '$lib/railway/grid.svelte';
	import { sim, placeLoco, kickSimulation } from '$lib/railway/sim.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import { svgPathD, sample } from '$lib/railway/geometry';
	import { dx, dy, opposite, isSwitch, type Dir, type PieceKind } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station';

	let { tool }: { tool: Tool } = $props();

	const TILE = 56;

	const widthPx = $derived(grid.width * TILE);
	const heightPx = $derived(grid.height * TILE);

	const cellEntries = $derived(
		[...grid.cells.entries()].map(([k, piece]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, piece };
		})
	);

	type VehiclePose = {
		key: string;
		kind: 'loco' | 'wagon';
		color: string;
		occupied: boolean;
		x: number;
		y: number;
		heading: number;
	};

	function poseOf(v: { x: number; y: number; pathIdx: number; t: number; dir: 1 | -1 }) {
		const piece = getPiece(v.x, v.y);
		if (!piece) return null;
		const path = pathsOf(piece)[v.pathIdx];
		if (!path) return null;
		const s = sample(path, v.t);
		return {
			x: (v.x + s.x) * TILE,
			y: (v.y + s.y) * TILE,
			heading: (s.heading * 180) / Math.PI + (v.dir === -1 ? 180 : 0)
		};
	}

	const vehiclePoses = $derived.by(() => {
		const out: VehiclePose[] = [];
		for (const l of sim.locos) {
			const lp = poseOf(l);
			if (lp)
				out.push({ key: `loco-${l.id}`, kind: 'loco', color: l.color, occupied: false, ...lp });
			for (let i = 0; i < l.wagons.length; i++) {
				const wp = poseOf(l.wagons[i]);
				if (wp)
					out.push({
						key: `wagon-${l.id}-${i}`,
						kind: 'wagon',
						color: l.color,
						occupied: i < l.passengers.length,
						...wp
					});
			}
		}
		return out;
	});

	type LocoBadge = {
		key: string;
		x: number;
		y: number;
		passengers: number;
		capacity: number;
		boarding: boolean;
	};

	const locoBadges = $derived.by(() => {
		const out: LocoBadge[] = [];
		for (const l of sim.locos) {
			const lp = poseOf(l);
			if (!lp) continue;
			out.push({
				key: `badge-${l.id}`,
				x: lp.x,
				y: lp.y,
				passengers: l.passengers.length,
				capacity: l.wagons.length,
				boarding: l.boardingAt !== null
			});
		}
		return out;
	});

	function darken(hex: string): string {
		const m = /^#([0-9a-f]{6})$/i.exec(hex);
		if (!m) return hex;
		const n = parseInt(m[1], 16);
		const r = Math.max(0, ((n >> 16) & 0xff) - 60);
		const g = Math.max(0, ((n >> 8) & 0xff) - 60);
		const b = Math.max(0, (n & 0xff) - 60);
		return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
	}

	function cellFromEvent(e: { clientX: number; clientY: number }, svg: SVGSVGElement) {
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		const ctm = svg.getScreenCTM();
		if (!ctm) return null;
		const local = pt.matrixTransform(ctm.inverse());
		const x = Math.floor(local.x / TILE);
		const y = Math.floor(local.y / TILE);
		if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return null;
		return { x, y };
	}

	type DrawState = {
		pointerId: number;
		moved: boolean;
		// The cell currently "in progress" — its entry port is known but its exit
		// port won't be decided until the cursor moves into a neighbour.
		lastCell: { x: number; y: number };
		lastEntry: Dir | null;
	};
	let draw: DrawState | null = null;

	function stepDirToward(from: { x: number; y: number }, to: { x: number; y: number }): Dir {
		const ddx = to.x - from.x;
		const ddy = to.y - from.y;
		if (Math.abs(ddx) >= Math.abs(ddy)) return (ddx > 0 ? 1 : 3) as Dir;
		return (ddy > 0 ? 2 : 0) as Dir;
	}

	function advanceDraw(target: { x: number; y: number }) {
		if (!draw) return;
		let safety = 1000;
		while (safety-- > 0) {
			const last = draw.lastCell;
			if (last.x === target.x && last.y === target.y) break;
			const stepDir = stepDirToward(last, target);
			const entry = draw.lastEntry ?? opposite(stepDir);
			drawPath(last.x, last.y, entry, stepDir);
			draw.lastCell = { x: last.x + dx[stepDir], y: last.y + dy[stepDir] };
			draw.lastEntry = opposite(stepDir);
			draw.moved = true;
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (tool !== 'draw') return;
		if (e.button !== 0 || e.shiftKey) return;
		const svg = e.currentTarget as SVGSVGElement;
		const cell = cellFromEvent(e, svg);
		if (!cell) return;
		svg.setPointerCapture(e.pointerId);
		draw = { pointerId: e.pointerId, moved: false, lastCell: cell, lastEntry: null };
		e.preventDefault();
	}

	function handlePointerMove(e: PointerEvent) {
		if (!draw || e.pointerId !== draw.pointerId) return;
		const svg = e.currentTarget as SVGSVGElement;
		const cell = cellFromEvent(e, svg);
		if (!cell) return;
		advanceDraw(cell);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!draw || e.pointerId !== draw.pointerId) return;
		const svg = e.currentTarget as SVGSVGElement;
		if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
		// Stub the trailing cell as a straight extension if drawing made any progress.
		if (draw.moved && draw.lastEntry !== null) {
			const { x, y } = draw.lastCell;
			drawPath(x, y, draw.lastEntry, opposite(draw.lastEntry));
		}
		draw = null;
	}

	function handleClick(e: MouseEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const cell = cellFromEvent(e, svg);
		if (!cell) return;
		const { x, y } = cell;

		const existing = getPiece(x, y);
		if (e.shiftKey) {
			if (existing && isSwitch(existing.kind)) toggleAt(x, y);
			return;
		}
		if (tool === 'draw') return; // pointerdown/up handles drawing
		if (tool === 'erase') {
			removeAt(x, y);
			return;
		}
		if (tool === 'loco') {
			placeLoco(x, y);
			return;
		}
		if (tool === 'station') {
			toggleStationAt(x, y);
			kickSimulation();
			return;
		}
		if (existing && existing.kind === tool) {
			rotateAt(x, y);
		} else {
			placePiece(x, y, tool);
		}
	}

	const stationEntries = $derived(
		[...grid.stations.entries()].map(([k, station]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, station };
		})
	);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	viewBox="0 0 {widthPx} {heightPx}"
	width={widthPx}
	height={heightPx}
	class="block bg-board-bg select-none"
	class:cursor-crosshair={tool === 'draw'}
	onclick={handleClick}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
	role="img"
	aria-label="Track grid"
>
	<defs>
		<pattern id="gridPattern" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
			<path
				d={`M ${TILE} 0 L 0 0 0 ${TILE}`}
				fill="none"
				class="stroke-board-grid"
				stroke-width="1"
			/>
		</pattern>
	</defs>

	<rect width={widthPx} height={heightPx} fill="url(#gridPattern)" />

	{#each cellEntries as { x, y, piece } (`${x},${y}`)}
		{@const switchTile = isSwitch(piece.kind)}
		{@const activeIdx = piece.active ?? 0}
		<g transform="translate({x * TILE} {y * TILE})">
			<rect width={TILE} height={TILE} class="fill-foreground/3" />
			{#each pathsOf(piece) as path, i (i)}
				{@const inactive = switchTile && i !== activeIdx}
				<path
					d={svgPathD(path, TILE)}
					fill="none"
					class={inactive ? 'stroke-track-inactive opacity-70' : 'stroke-track-active'}
					stroke-width={inactive ? Math.round(TILE * 0.1) : Math.round(TILE * 0.15)}
					stroke-linecap="round"
				/>
				{#if !inactive}
					<path
						d={svgPathD(path, TILE)}
						fill="none"
						class="stroke-track-rail"
						stroke-width={Math.max(2, Math.round(TILE * 0.05))}
						stroke-dasharray="4 4"
					/>
				{/if}
			{/each}
			{#if switchTile}
				<circle
					cx={TILE / 2}
					cy={TILE / 2}
					r={Math.max(3, Math.round(TILE * 0.075))}
					class="fill-switch-marker"
				/>
			{/if}
		</g>
	{/each}

	{#each stationEntries as { x, y, station } (`station-${x},${y}`)}
		{@const hasPeople = station.peopleWaiting > 0}
		<g transform="translate({x * TILE} {y * TILE})">
			<rect
				x={TILE * 0.08}
				y={TILE * 0.04}
				width={TILE * 0.84}
				height={TILE * 0.28}
				rx={TILE * 0.06}
				fill={hasPeople ? '#f59e0b' : '#94a3b8'}
				fill-opacity="0.92"
				stroke={hasPeople ? '#92400e' : '#475569'}
				stroke-width="1.5"
			/>
			<text
				x={TILE * 0.5}
				y={TILE * 0.22}
				text-anchor="middle"
				dominant-baseline="middle"
				font-size={TILE * 0.2}
				font-weight="700"
				fill="#ffffff"
				style="paint-order: stroke; stroke: rgba(0,0,0,0.35); stroke-width: 2;"
			>
				{station.peopleWaiting}
			</text>
		</g>
	{/each}

	{#each vehiclePoses as pose (pose.key)}
		<g transform="translate({pose.x} {pose.y}) rotate({pose.heading})">
			{#if pose.kind === 'loco'}
				<rect
					x={-TILE * 0.32}
					y={-TILE * 0.18}
					width={TILE * 0.64}
					height={TILE * 0.36}
					rx={TILE * 0.08}
					fill={pose.color}
					stroke={darken(pose.color)}
					stroke-width="1.5"
				/>
				<rect
					x={TILE * 0.16}
					y={-TILE * 0.1}
					width={TILE * 0.16}
					height={TILE * 0.2}
					fill="#fbbf24"
				/>
			{:else}
				<rect
					x={-TILE * 0.27}
					y={-TILE * 0.16}
					width={TILE * 0.54}
					height={TILE * 0.32}
					rx={TILE * 0.06}
					fill={pose.color}
					stroke={darken(pose.color)}
					stroke-width="1.5"
				/>
				{#if pose.occupied}
					<circle
						cx="0"
						cy="0"
						r={TILE * 0.08}
						fill="#fef3c7"
						stroke={darken(pose.color)}
						stroke-width="1"
					/>
				{/if}
			{/if}
		</g>
	{/each}

	{#each locoBadges as b (b.key)}
		<g transform="translate({b.x} {b.y - TILE * 0.45})">
			<rect
				x={-TILE * 0.22}
				y={-TILE * 0.13}
				width={TILE * 0.44}
				height={TILE * 0.24}
				rx={TILE * 0.05}
				fill={b.boarding ? '#10b981' : '#1e293b'}
				fill-opacity="0.9"
				stroke="#ffffff"
				stroke-width="1"
			/>
			<text
				x="0"
				y="0"
				text-anchor="middle"
				dominant-baseline="middle"
				font-size={TILE * 0.16}
				font-weight="700"
				fill="#ffffff"
			>
				{b.passengers}/{b.capacity}
			</text>
		</g>
	{/each}
</svg>
