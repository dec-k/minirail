<script lang="ts">
	import {
		grid,
		getPiece,
		placePiece,
		rotateAt,
		removeAt,
		toggleAt,
		drawPath,
		toggleStationAt,
		placeDecoration,
		setDecoration,
		getDecoration,
		placementFx
	} from '$lib/railway/grid.svelte';
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { sim, placeLoco, kickSimulation } from '$lib/railway/sim.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import { svgPathD, sample } from '$lib/railway/geometry';
	import {
		dx,
		dy,
		opposite,
		isSwitch,
		type DecorationKind,
		type Dir,
		type PieceKind,
		type TilePath
	} from '$lib/railway/types';
	import {
		buildingSpots,
		grassTufts,
		stoneSpots,
		treeSpots,
		waveGlints
	} from '$lib/railway/decorations';
	import { particles } from '$lib/railway/particles.svelte';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate';

	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();

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

	type SleeperTick = { cx: number; cy: number; nx: number; ny: number };

	function sleeperTicks(path: TilePath, count: number, halfLen: number): SleeperTick[] {
		const out: SleeperTick[] = [];
		for (let i = 0; i < count; i++) {
			const t = (i + 0.5) / count;
			const s = sample(path, t);
			out.push({
				cx: s.x * TILE,
				cy: s.y * TILE,
				nx: -Math.sin(s.heading) * halfLen,
				ny: Math.cos(s.heading) * halfLen
			});
		}
		return out;
	}

	// Pick which edge of the tile to render the station platform on. Stations
	// only exist on cells with track; if the tile's path is purely vertical
	// (N↔S) the platform goes on the east edge to sit alongside the rails,
	// otherwise on the south edge.
	function platformOrientation(x: number, y: number): 'south' | 'east' {
		const piece = getPiece(x, y);
		if (!piece) return 'south';
		const paths = pathsOf(piece);
		if (paths.length === 0) return 'south';
		for (const p of paths) {
			if (p.from === 1 || p.from === 3 || p.to === 1 || p.to === 3) return 'south';
		}
		return 'east';
	}

	// Snap a freshly placed tile in with a small overshoot. Returns a no-op when
	// `placementFx.suppressIntro` is set (bulk loads via applyLayout) so the
	// transition doesn't fire dozens of times at once.
	function placeIntro(node: SVGElement) {
		if (placementFx.suppressIntro) return {};
		return scale(node, { start: 0.7, opacity: 0.4, duration: 220, easing: backOut });
	}

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

	// View transform. Applied as a CSS transform on a wrapper around the SVG so
	// the SVG's getScreenCTM() resolves pointer coords back to grid cells with
	// no extra math here.
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);

	type PanState = {
		pointerId: number;
		startX: number;
		startY: number;
		origPanX: number;
		origPanY: number;
	};
	let pan: PanState | null = $state(null);

	const MIN_ZOOM = 0.25;
	const MAX_ZOOM = 4;

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cy = e.clientY - rect.top;
		// Anchor the zoom on the world point under the cursor: it should stay
		// pinned to the cursor as zoom changes.
		const wx = (cx - panX) / zoom;
		const wy = (cy - panY) / zoom;
		const factor = Math.exp(-e.deltaY * 0.0015);
		const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
		zoom = next;
		panX = cx - wx * next;
		panY = cy - wy * next;
	}

	function handlePanDown(e: PointerEvent) {
		// Middle-mouse drag pans. Left button is owned by the active tool; right
		// button is left alone for native browser menus.
		if (e.button !== 1) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pan = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			origPanX: panX,
			origPanY: panY
		};
	}

	function handlePanMove(e: PointerEvent) {
		if (!pan || e.pointerId !== pan.pointerId) return;
		panX = pan.origPanX + (e.clientX - pan.startX);
		panY = pan.origPanY + (e.clientY - pan.startY);
	}

	function handlePanUp(e: PointerEvent) {
		if (!pan || e.pointerId !== pan.pointerId) return;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
		pan = null;
	}

	// Paint state for the decorate tool. A pointerup with `moved=false` toggles
	// the start cell (same as a click); a drag paints every cell crossed using
	// set semantics (never toggles off).
	type PaintState = {
		pointerId: number;
		moved: boolean;
		startCell: { x: number; y: number };
		lastCell: { x: number; y: number };
		kind: DecorationKind;
	};
	let paint: PaintState | null = null;

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

	function advancePaint(target: { x: number; y: number }) {
		if (!paint) return;
		let safety = 1000;
		while (safety-- > 0) {
			const last = paint.lastCell;
			if (last.x === target.x && last.y === target.y) break;
			const stepDir = stepDirToward(last, target);
			const nx = last.x + dx[stepDir];
			const ny = last.y + dy[stepDir];
			setDecoration(nx, ny, paint.kind);
			paint.lastCell = { x: nx, y: ny };
			paint.moved = true;
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0 || e.shiftKey) return;
		const svg = e.currentTarget as SVGSVGElement;
		const cell = cellFromEvent(e, svg);
		if (!cell) return;
		if (tool === 'draw') {
			svg.setPointerCapture(e.pointerId);
			draw = { pointerId: e.pointerId, moved: false, lastCell: cell, lastEntry: null };
			e.preventDefault();
			return;
		}
		if (tool === 'decorate') {
			svg.setPointerCapture(e.pointerId);
			paint = {
				pointerId: e.pointerId,
				moved: false,
				startCell: cell,
				lastCell: cell,
				kind: decorationKind
			};
			e.preventDefault();
			return;
		}
	}

	function handlePointerMove(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		if (draw && e.pointerId === draw.pointerId) {
			const cell = cellFromEvent(e, svg);
			if (!cell) return;
			advanceDraw(cell);
			return;
		}
		if (paint && e.pointerId === paint.pointerId) {
			const cell = cellFromEvent(e, svg);
			if (!cell) return;
			if (cell.x === paint.lastCell.x && cell.y === paint.lastCell.y) return;
			// First movement confirms a drag — place the starting cell too so the
			// painted line includes where the user pressed down.
			if (!paint.moved) {
				setDecoration(paint.startCell.x, paint.startCell.y, paint.kind);
			}
			advancePaint(cell);
		}
	}

	function handlePointerUp(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		if (draw && e.pointerId === draw.pointerId) {
			if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
			// Stub the trailing cell as a straight extension if drawing made any progress.
			if (draw.moved && draw.lastEntry !== null) {
				const { x, y } = draw.lastCell;
				drawPath(x, y, draw.lastEntry, opposite(draw.lastEntry));
			}
			draw = null;
			return;
		}
		if (paint && e.pointerId === paint.pointerId) {
			if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
			// A click without drag falls through to toggle semantics so the user
			// can still single-click to remove a decoration of the same kind.
			if (!paint.moved) {
				placeDecoration(paint.startCell.x, paint.startCell.y, paint.kind);
			}
			paint = null;
			return;
		}
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
		if (tool === 'decorate') return; // pointerdown/up handles paint + toggle
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

	const decorationEntries = $derived(
		[...grid.decorations.entries()].map(([k, decoration]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, decoration };
		})
	);

	const groundOverEntries = $derived(
		[...grid.groundOvers.entries()].map(([k, groundOver]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, groundOver };
		})
	);

	// Canvas-based particle renderer. Sits above the SVG inside the same
	// transformed wrapper so pan/zoom are inherited for free. Driven by a local
	// rAF that runs only while particles exist (or to clear one final frame).
	let canvasEl: HTMLCanvasElement | undefined = $state();

	function drawParticles(ctx: CanvasRenderingContext2D) {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		for (const p of particles.list) {
			const t = Math.min(1, p.life / p.maxLife);
			const cx = p.x * TILE;
			const cy = p.y * TILE;
			const r = (0.1 + t * 0.22) * TILE;
			const alpha = (1 - t) * 0.55;
			const tint = Math.floor(255 - t * 50);
			const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
			grad.addColorStop(0, `rgba(${tint},${tint},${tint},${alpha})`);
			grad.addColorStop(0.5, `rgba(${tint},${tint},${tint},${alpha * 0.45})`);
			grad.addColorStop(1, `rgba(${tint},${tint},${tint},0)`);
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		let raf = 0;
		let lastDrewCount = 0;
		const frame = () => {
			const n = particles.list.length;
			if (n > 0 || lastDrewCount > 0) {
				drawParticles(ctx);
				lastDrewCount = n;
			}
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute inset-0 overflow-hidden bg-background"
	class:cursor-grabbing={pan !== null}
	onwheel={handleWheel}
	onpointerdown={handlePanDown}
	onpointermove={handlePanMove}
	onpointerup={handlePanUp}
	onpointercancel={handlePanUp}
	onauxclick={(e) => e.preventDefault()}
>
<div
	class="absolute top-0 left-0 origin-top-left overflow-hidden rounded-lg bg-board-bg shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
	style="transform: translate({panX}px, {panY}px) scale({zoom})"
>
	<svg
		viewBox="0 0 {widthPx} {heightPx}"
		width={widthPx}
		height={heightPx}
		class="block select-none"
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

		{#each groundOverEntries as { x, y, groundOver } (`ground-${x},${y}`)}
			<g transform="translate({x * TILE} {y * TILE})">
				<g
					in:placeIntro|local
					style="transform-box: fill-box; transform-origin: center;"
				>
				{#if groundOver.kind === 'grass'}
					<rect width={TILE} height={TILE} fill="#9dd07a" />
					{#each grassTufts(x, y) as tuft, i (i)}
						{@const cx = tuft.cx * TILE}
						{@const cy = tuft.cy * TILE}
						{@const blade = TILE * 0.07}
						<path
							d={`M ${cx - blade * 0.45} ${cy + blade * 0.5} L ${cx - blade * 0.55} ${cy - blade * 0.7} M ${cx} ${cy + blade * 0.5} L ${cx} ${cy - blade} M ${cx + blade * 0.45} ${cy + blade * 0.5} L ${cx + blade * 0.55} ${cy - blade * 0.7}`}
							stroke={tuft.tone > 0.5 ? '#4f7a36' : '#5b8c3e'}
							stroke-width={1.4}
							stroke-linecap="round"
							fill="none"
						/>
					{/each}
				{:else if groundOver.kind === 'stone'}
					<rect width={TILE} height={TILE} fill="#d4d4d8" />
					{#each stoneSpots(x, y) as spot, i (i)}
						<circle
							cx={spot.cx * TILE}
							cy={spot.cy * TILE}
							r={spot.r * TILE}
							fill={spot.tone > 0.55 ? '#71717a' : '#a1a1aa'}
						/>
					{/each}
				{/if}
				</g>
			</g>
		{/each}

		{#each decorationEntries as { x, y, decoration } (`deco-${x},${y}`)}
			<g transform="translate({x * TILE} {y * TILE})">
				<g
					in:placeIntro|local
					style="transform-box: fill-box; transform-origin: center;"
				>
				{#if decoration.kind === 'water'}
					{@const nN = getDecoration(x, y - 1)?.kind === 'water'}
					{@const nE = getDecoration(x + 1, y)?.kind === 'water'}
					{@const nS = getDecoration(x, y + 1)?.kind === 'water'}
					{@const nW = getDecoration(x - 1, y)?.kind === 'water'}
					<rect width={TILE} height={TILE} fill="#3a8fc7" />
					{#each waveGlints(x, y) as g, i (i)}
						<line
							x1={(g.cx - g.len * 0.5) * TILE}
							y1={g.cy * TILE}
							x2={(g.cx + g.len * 0.5) * TILE}
							y2={g.cy * TILE}
							stroke="#ffffff"
							stroke-width={1.6}
							stroke-linecap="round"
							class="wave-glint"
							style="animation-delay: -{((x * 0.73 + y * 0.41 + i * 0.6) % 2.4).toFixed(2)}s"
						/>
					{/each}
					{#if !nN}
						<line
							x1={0}
							y1={2}
							x2={TILE}
							y2={2}
							stroke="#d9eef9"
							stroke-opacity="0.9"
							stroke-width={2.5}
						/>
					{/if}
					{#if !nE}
						<line
							x1={TILE - 2}
							y1={0}
							x2={TILE - 2}
							y2={TILE}
							stroke="#d9eef9"
							stroke-opacity="0.9"
							stroke-width={2.5}
						/>
					{/if}
					{#if !nS}
						<line
							x1={0}
							y1={TILE - 2}
							x2={TILE}
							y2={TILE - 2}
							stroke="#d9eef9"
							stroke-opacity="0.9"
							stroke-width={2.5}
						/>
					{/if}
					{#if !nW}
						<line
							x1={2}
							y1={0}
							x2={2}
							y2={TILE}
							stroke="#d9eef9"
							stroke-opacity="0.9"
							stroke-width={2.5}
						/>
					{/if}
				{:else if decoration.kind === 'tree'}
					{#each treeSpots(x, y) as t, i (i)}
						{@const tx = t.cx * TILE}
						{@const ty = t.cy * TILE}
						{@const tr = t.r * TILE}
						<ellipse
							cx={tx}
							cy={ty + tr * 0.85}
							rx={tr * 0.78}
							ry={tr * 0.24}
							fill="#000"
							fill-opacity="0.18"
						/>
						<rect
							x={tx - TILE * 0.025}
							y={ty + tr * 0.4}
							width={TILE * 0.05}
							height={tr * 0.55}
							fill="#6b3a12"
						/>
						<circle cx={tx} cy={ty} r={tr} fill={t.tone > 0.5 ? '#3f6e2e' : '#467a35'} />
						<circle cx={tx} cy={ty} r={tr * 0.94} fill={t.tone > 0.5 ? '#5b9d47' : '#67a652'} />
						<circle
							cx={tx - tr * 0.3}
							cy={ty - tr * 0.3}
							r={tr * 0.55}
							fill={t.tone > 0.5 ? '#8fc56e' : '#a0d27e'}
							fill-opacity="0.9"
						/>
					{/each}
				{:else if decoration.kind === 'building'}
					{#each buildingSpots(x, y) as h, i (i)}
						{@const w = h.size * TILE}
						{@const ht = h.size * TILE * 0.78}
						{@const cx = h.cx * TILE}
						{@const cy = h.cy * TILE}
						{@const bodyTop = cy - ht * 0.4}
						{@const bodyBot = cy + ht * 0.6}
						{@const bodyLeft = cx - w * 0.5}
						{@const bodyRight = cx + w * 0.5}
						{@const roofPeak = bodyTop - w * 0.45}
						{@const overhang = w * 0.08}
						{@const body = h.tone > 0.5 ? '#f0dfc2' : '#e0cfae'}
						{@const roof =
							h.roofTone < 0.34 ? '#a04d3a' : h.roofTone < 0.67 ? '#7a5535' : '#5a6072'}
						<ellipse
							{cx}
							cy={bodyBot + w * 0.06}
							rx={w * 0.58}
							ry={w * 0.14}
							fill="#000"
							fill-opacity="0.18"
						/>
						<rect
							x={bodyLeft}
							y={bodyTop}
							width={w}
							height={bodyBot - bodyTop}
							fill={body}
							stroke="#3a2a1a"
							stroke-width="1"
						/>
						<polygon
							points="{bodyLeft - overhang},{bodyTop} {bodyRight +
								overhang},{bodyTop} {cx},{roofPeak}"
							fill={roof}
							stroke="#3a2a1a"
							stroke-width="1"
							stroke-linejoin="round"
						/>
						<rect
							x={cx - w * 0.09}
							y={bodyBot - ht * 0.42}
							width={w * 0.18}
							height={ht * 0.42}
							fill="#3a2a1a"
						/>
					{/each}
				{/if}
				</g>
			</g>
		{/each}

		{#each cellEntries as { x, y, piece } (`${x},${y}`)}
			{@const switchTile = isSwitch(piece.kind)}
			{@const activeIdx = piece.active ?? 0}
			{@const ordered = pathsOf(piece)
				.map((p, i) => ({ p, i, inactive: switchTile && i !== activeIdx }))
				.sort((a, b) => Number(b.inactive) - Number(a.inactive))}
			<g transform="translate({x * TILE} {y * TILE})">
				<g
					in:placeIntro|local
					style="transform-box: fill-box; transform-origin: center;"
				>
				<rect width={TILE} height={TILE} class="fill-foreground/3" />
				{#each ordered as { p, i, inactive } (i)}
					<path
						d={svgPathD(p, TILE)}
						fill="none"
						stroke={inactive ? '#d6cdb8' : '#c8a878'}
						stroke-width={Math.round(TILE * 0.46)}
						stroke-linecap="butt"
						opacity={inactive ? 0.65 : 1}
					/>
					{#each sleeperTicks(p, 5, TILE * 0.21) as tick, k (k)}
						<line
							x1={tick.cx - tick.nx}
							y1={tick.cy - tick.ny}
							x2={tick.cx + tick.nx}
							y2={tick.cy + tick.ny}
							stroke={inactive ? '#9b8b6e' : '#5a3a1f'}
							stroke-width={Math.max(2, Math.round(TILE * 0.07))}
							stroke-linecap="round"
							opacity={inactive ? 0.55 : 0.92}
						/>
					{/each}
					<path
						d={svgPathD(p, TILE)}
						fill="none"
						class={inactive ? 'stroke-track-inactive' : 'stroke-track-active'}
						stroke-width={Math.round(TILE * 0.22)}
						stroke-linecap="butt"
						opacity={inactive ? 0.6 : 1}
					/>
					<path
						d={svgPathD(p, TILE)}
						fill="none"
						stroke={inactive ? '#d6cdb8' : '#c8a878'}
						stroke-width={Math.round(TILE * 0.12)}
						stroke-linecap="butt"
						opacity={inactive ? 0.7 : 1}
					/>
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
			</g>
		{/each}

		{#each stationEntries as { x, y, station } (`station-${x},${y}`)}
			{@const hasPeople = station.peopleWaiting > 0}
			{@const orient = platformOrientation(x, y)}
			{@const headCount = Math.min(station.peopleWaiting, 5)}
			<g transform="translate({x * TILE} {y * TILE})">
				{#if orient === 'south'}
					<rect
						x={TILE * 0.05}
						y={TILE * 0.76}
						width={TILE * 0.9}
						height={TILE * 0.18}
						rx={TILE * 0.025}
						fill="#d6c598"
						stroke="#7a6543"
						stroke-width="1"
					/>
					<rect
						x={TILE * 0.32}
						y={TILE * 0.64}
						width={TILE * 0.36}
						height={TILE * 0.14}
						fill="#8a6a48"
						stroke="#3a2a1a"
						stroke-width="1"
					/>
					<rect
						x={TILE * 0.28}
						y={TILE * 0.6}
						width={TILE * 0.44}
						height={TILE * 0.06}
						fill="#3a2a1a"
					/>
					{#each Array.from({ length: headCount }) as _, pi (pi)}
						<circle
							cx={TILE * (0.18 + pi * 0.16)}
							cy={TILE * 0.88}
							r={TILE * 0.045}
							fill="#fbe49d"
							stroke="#7a5535"
							stroke-width="0.6"
						/>
					{/each}
				{:else}
					<rect
						x={TILE * 0.76}
						y={TILE * 0.34}
						width={TILE * 0.18}
						height={TILE * 0.6}
						rx={TILE * 0.025}
						fill="#d6c598"
						stroke="#7a6543"
						stroke-width="1"
					/>
					<rect
						x={TILE * 0.64}
						y={TILE * 0.45}
						width={TILE * 0.14}
						height={TILE * 0.36}
						fill="#8a6a48"
						stroke="#3a2a1a"
						stroke-width="1"
					/>
					<rect
						x={TILE * 0.6}
						y={TILE * 0.41}
						width={TILE * 0.06}
						height={TILE * 0.44}
						fill="#3a2a1a"
					/>
					{#each Array.from({ length: headCount }) as _, pi (pi)}
						<circle
							cx={TILE * 0.85}
							cy={TILE * (0.43 + pi * 0.105)}
							r={TILE * 0.045}
							fill="#fbe49d"
							stroke="#7a5535"
							stroke-width="0.6"
						/>
					{/each}
				{/if}
				<rect
					x={TILE * 0.08}
					y={TILE * 0.04}
					width={TILE * 0.84}
					height={TILE * 0.24}
					rx={TILE * 0.06}
					fill={hasPeople ? '#f59e0b' : '#94a3b8'}
					fill-opacity="0.92"
					stroke={hasPeople ? '#92400e' : '#475569'}
					stroke-width="1.5"
				/>
				<text
					x={TILE * 0.5}
					y={TILE * 0.18}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size={TILE * 0.18}
					font-weight="700"
					fill="#ffffff"
					style="paint-order: stroke; stroke: rgba(0,0,0,0.35); stroke-width: 2;"
				>
					{station.peopleWaiting}
				</text>
			</g>
		{/each}

		{#each vehiclePoses as pose (pose.key)}
			{@const dark = darken(pose.color)}
			<g transform="translate({pose.x} {pose.y}) rotate({pose.heading})">
				{#if pose.kind === 'loco'}
					{@const bodyL = -TILE * 0.32}
					{@const bodyR = TILE * 0.32}
					{@const halfH = TILE * 0.18}
					<ellipse
						cx="0"
						cy={halfH * 1.1}
						rx={TILE * 0.36}
						ry={halfH * 0.45}
						fill="#000"
						fill-opacity="0.18"
					/>
					<rect x={bodyL - 3} y="-2.5" width="3" height="5" fill="#222" />
					<rect x={-TILE * 0.22} y={-halfH - 2} width={TILE * 0.07} height="3" fill="#222" />
					<rect x={-TILE * 0.22} y={halfH - 1} width={TILE * 0.07} height="3" fill="#222" />
					<rect x={TILE * 0.06} y={-halfH - 2} width={TILE * 0.07} height="3" fill="#222" />
					<rect x={TILE * 0.06} y={halfH - 1} width={TILE * 0.07} height="3" fill="#222" />
					<rect
						x={bodyL}
						y={-halfH}
						width={TILE * 0.64}
						height={halfH * 2}
						rx={TILE * 0.07}
						fill={pose.color}
						stroke={dark}
						stroke-width="1.5"
					/>
					<rect
						x={bodyL}
						y={-halfH}
						width={TILE * 0.22}
						height={halfH * 2}
						rx={TILE * 0.07}
						fill={dark}
						fill-opacity="0.55"
					/>
					<rect
						x={bodyL + TILE * 0.05}
						y={-TILE * 0.08}
						width={TILE * 0.12}
						height={TILE * 0.16}
						rx="1.5"
						fill="#fde68a"
					/>
					<circle cx={TILE * 0.05} cy="0" r={TILE * 0.065} fill="#1a1a1a" />
					<circle cx={TILE * 0.05} cy="0" r={TILE * 0.04} fill="#555" />
					<circle
						cx={bodyR - TILE * 0.03}
						cy="0"
						r={TILE * 0.04}
						fill="#fef3c7"
						stroke="#92400e"
						stroke-width="0.5"
					/>
					<polygon
						points="{bodyR},{-halfH + 1} {bodyR + TILE * 0.09},0 {bodyR},{halfH - 1}"
						fill="#3a3a3a"
						stroke="#1a1a1a"
						stroke-width="0.5"
					/>
				{:else}
					{@const wL = -TILE * 0.27}
					{@const wR = TILE * 0.27}
					{@const whalfH = TILE * 0.16}
					<ellipse
						cx="0"
						cy={whalfH * 1.1}
						rx={TILE * 0.3}
						ry={whalfH * 0.45}
						fill="#000"
						fill-opacity="0.18"
					/>
					<rect x={wL - 3} y="-2.5" width="3" height="5" fill="#222" />
					<rect x={wR} y="-2.5" width="3" height="5" fill="#222" />
					<rect x={-TILE * 0.18} y={-whalfH - 2} width={TILE * 0.07} height="3" fill="#222" />
					<rect x={-TILE * 0.18} y={whalfH - 1} width={TILE * 0.07} height="3" fill="#222" />
					<rect x={TILE * 0.11} y={-whalfH - 2} width={TILE * 0.07} height="3" fill="#222" />
					<rect x={TILE * 0.11} y={whalfH - 1} width={TILE * 0.07} height="3" fill="#222" />
					<rect
						x={wL}
						y={-whalfH}
						width={TILE * 0.54}
						height={whalfH * 2}
						rx={TILE * 0.05}
						fill={pose.color}
						stroke={dark}
						stroke-width="1.5"
					/>
					{#if pose.occupied}
						<circle
							cx="0"
							cy="0"
							r={TILE * 0.06}
							fill="#fbe49d"
							stroke="#7a5535"
							stroke-width="0.7"
						/>
					{/if}
				{/if}
			</g>
		{/each}

	</svg>
	<canvas
		bind:this={canvasEl}
		width={widthPx}
		height={heightPx}
		class="pointer-events-none absolute top-0 left-0"
		style="width: {widthPx}px; height: {heightPx}px;"
	></canvas>
	<svg
		viewBox="0 0 {widthPx} {heightPx}"
		width={widthPx}
		height={heightPx}
		class="pointer-events-none absolute top-0 left-0 block select-none"
		role="presentation"
	>
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
</div>
</div>

<style>
	.wave-glint {
		stroke-opacity: 0.3;
		animation: water-shimmer 2.4s ease-in-out infinite;
	}
	@keyframes water-shimmer {
		0%,
		100% {
			stroke-opacity: 0.18;
		}
		50% {
			stroke-opacity: 0.65;
		}
	}
</style>
