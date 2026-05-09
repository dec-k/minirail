<script lang="ts">
	import { grid, getPiece, placePiece, rotateAt, removeAt, toggleAt } from '$lib/railway/grid.svelte';
	import { sim, placeLoco } from '$lib/railway/sim.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import { svgPathD, sample } from '$lib/railway/geometry';
	import { isSwitch, type PieceKind } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase';

	let { tool }: { tool: Tool } = $props();

	const TILE = 40;

	const widthPx = $derived(grid.width * TILE);
	const heightPx = $derived(grid.height * TILE);

	const cellEntries = $derived([...grid.cells.entries()].map(([k, piece]) => {
		const [x, y] = k.split(',').map(Number);
		return { x, y, piece };
	}));

	const locoPose = $derived.by(() => {
		const l = sim.loco;
		if (!l) return null;
		const piece = getPiece(l.x, l.y);
		if (!piece) return null;
		const paths = pathsOf(piece);
		const path = paths[l.pathIdx];
		if (!path) return null;
		const s = sample(path, l.t);
		const x = (l.x + s.x) * TILE;
		const y = (l.y + s.y) * TILE;
		const headingDeg = (s.heading * 180) / Math.PI + (l.dir === -1 ? 180 : 0);
		return { x, y, heading: headingDeg };
	});

	function handleClick(e: MouseEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		const ctm = svg.getScreenCTM();
		if (!ctm) return;
		const local = pt.matrixTransform(ctm.inverse());
		const x = Math.floor(local.x / TILE);
		const y = Math.floor(local.y / TILE);
		if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;

		const existing = getPiece(x, y);
		if (e.shiftKey) {
			if (existing && isSwitch(existing.kind)) toggleAt(x, y);
			return;
		}
		if (tool === 'erase') {
			removeAt(x, y);
			return;
		}
		if (tool === 'loco') {
			placeLoco(x, y);
			return;
		}
		if (existing && existing.kind === tool) {
			rotateAt(x, y);
		} else {
			placePiece(x, y, tool);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	viewBox="0 0 {widthPx} {heightPx}"
	width={widthPx}
	height={heightPx}
	class="border border-slate-400 bg-slate-50 select-none"
	onclick={handleClick}
	role="img"
	aria-label="Track grid"
>
	<defs>
		<pattern id="gridPattern" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
			<path
				d={`M ${TILE} 0 L 0 0 0 ${TILE}`}
				fill="none"
				stroke="#cbd5e1"
				stroke-width="1"
			/>
		</pattern>
	</defs>

	<rect width={widthPx} height={heightPx} fill="url(#gridPattern)" />

	{#each cellEntries as { x, y, piece } (`${x},${y}`)}
		{@const switchTile = isSwitch(piece.kind)}
		{@const activeIdx = piece.active ?? 0}
		<g transform="translate({x * TILE} {y * TILE})">
			<rect width={TILE} height={TILE} fill="#1e293b" opacity="0.04" />
			{#each pathsOf(piece) as path, i}
				{@const inactive = switchTile && i !== activeIdx}
				<path
					d={svgPathD(path, TILE)}
					fill="none"
					stroke={inactive ? '#cbd5e1' : '#475569'}
					stroke-width={inactive ? 4 : 6}
					stroke-linecap="round"
					opacity={inactive ? 0.7 : 1}
				/>
				{#if !inactive}
					<path
						d={svgPathD(path, TILE)}
						fill="none"
						stroke="#cbd5e1"
						stroke-width="2"
						stroke-dasharray="3 3"
					/>
				{/if}
			{/each}
			{#if switchTile}
				<circle cx={TILE / 2} cy={TILE / 2} r="3" fill="#16a34a" />
			{/if}
		</g>
	{/each}

	{#if locoPose}
		<g transform="translate({locoPose.x} {locoPose.y}) rotate({locoPose.heading})">
			<rect x="-12" y="-7" width="24" height="14" rx="3" fill="#dc2626" stroke="#7f1d1d" stroke-width="1" />
			<rect x="6" y="-4" width="6" height="8" fill="#fbbf24" />
		</g>
	{/if}
</svg>
