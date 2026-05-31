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
		setDecoration
	} from '$lib/railway/grid.svelte';
	import { sim, placeLoco, kickSimulation } from '$lib/railway/sim.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import { sample } from '$lib/railway/geometry';
	import {
		dx,
		dy,
		opposite,
		isSwitch,
		type DecorationKind,
		type Dir,
		type PieceKind
	} from '$lib/railway/types';
	import { TILE } from './board/constants';
	import GroundOverTile from './board/GroundOverTile.svelte';
	import DecorationTile from './board/DecorationTile.svelte';
	import TrackTile from './board/TrackTile.svelte';
	import StationTile from './board/StationTile.svelte';
	import Vehicle from './board/Vehicle.svelte';
	import LocoBadge from './board/LocoBadge.svelte';
	import ParticleLayer from './board/ParticleLayer.svelte';
	import LightingLayer from './board/LightingLayer.svelte';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan';

	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();

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

	const locoLights = $derived.by(() => {
		const out: { key: string; x: number; y: number; heading: number }[] = [];
		for (const l of sim.locos) {
			const lp = poseOf(l);
			if (lp) out.push({ key: `light-${l.id}`, x: lp.x, y: lp.y, heading: lp.heading });
		}
		return out;
	});

	type LocoBadgeData = {
		key: string;
		x: number;
		y: number;
		passengers: number;
		capacity: number;
		boarding: boolean;
	};

	const locoBadges = $derived.by(() => {
		const out: LocoBadgeData[] = [];
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
		// Pan triggers: right-mouse drag, or any primary press while the pan tool
		// is active (covers touch + left-click). Middle-mouse still works as a
		// convenience for users who expect it.
		const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
		const toolPan = tool === 'pan' && (e.button === 0 || isTouch);
		if (e.button !== 1 && e.button !== 2 && !toolPan) return;
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
		if (tool === 'pan') return;
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
		if (tool === 'pan') return;
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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute inset-0 touch-pinch-zoom overflow-hidden bg-background"
	class:cursor-grab={tool === 'pan' && pan === null}
	class:cursor-grabbing={pan !== null}
	onwheel={handleWheel}
	onpointerdown={handlePanDown}
	onpointermove={handlePanMove}
	onpointerup={handlePanUp}
	onpointercancel={handlePanUp}
	onauxclick={(e) => e.preventDefault()}
	oncontextmenu={(e) => e.preventDefault()}
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
				<GroundOverTile {x} {y} kind={groundOver.kind} />
			{/each}

			{#each decorationEntries as { x, y, decoration } (`deco-${x},${y}`)}
				<DecorationTile {x} {y} kind={decoration.kind} />
			{/each}

			{#each cellEntries as { x, y, piece } (`${x},${y}`)}
				<TrackTile {x} {y} {piece} />
			{/each}

			{#each stationEntries as { x, y, station } (`station-${x},${y}`)}
				<StationTile {x} {y} {station} />
			{/each}

			{#each vehiclePoses as pose (pose.key)}
				<Vehicle
					kind={pose.kind}
					color={pose.color}
					occupied={pose.occupied}
					x={pose.x}
					y={pose.y}
					heading={pose.heading}
				/>
			{/each}
		</svg>
		<ParticleLayer {widthPx} {heightPx} />
		<LightingLayer {widthPx} {heightPx} {locoLights} />
		<svg
			viewBox="0 0 {widthPx} {heightPx}"
			width={widthPx}
			height={heightPx}
			class="pointer-events-none absolute top-0 left-0 block select-none"
			role="presentation"
		>
			{#each locoBadges as b (b.key)}
				<LocoBadge
					x={b.x}
					y={b.y}
					passengers={b.passengers}
					capacity={b.capacity}
					boarding={b.boarding}
				/>
			{/each}
		</svg>
	</div>
</div>
