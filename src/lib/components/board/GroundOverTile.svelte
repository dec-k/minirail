<script lang="ts">
	import {
		grassTufts,
		stoneSpots,
		terrainBlob,
		terrainEncroachBand,
		TERRAIN_COLORS
	} from '$lib/railway/decorations';
	import { getGroundOver } from '$lib/railway/grid.svelte';
	import type { DecorationKind } from '$lib/railway/types';
	import { TILE, placeIntro } from './constants';

	let { x, y, kind }: { x: number; y: number; kind: DecorationKind } = $props();

	const edges = [
		['N', 0, -1],
		['E', 1, 0],
		['S', 0, 1],
		['W', -1, 0]
	] as const;

	// Organic outline: an edge bordering *any* groundover bleeds straight over (so
	// grass and stone abut without a gap); only edges facing empty space are pulled
	// in and waved.
	const blob = $derived(
		terrainBlob(
			x,
			y,
			{
				n: !!getGroundOver(x, y - 1),
				e: !!getGroundOver(x + 1, y),
				s: !!getGroundOver(x, y + 1),
				w: !!getGroundOver(x - 1, y)
			},
			TILE
		)
	);

	// Where a different groundover neighbours this tile, let it encroach a wavy band
	// so grass and stone interlock instead of meeting on a hard grid line.
	const bleed = $derived(
		edges
			.map(([edge, dx, dy]) => ({ edge, k: getGroundOver(x + dx, y + dy)?.kind }))
			.filter((e): e is { edge: 'N' | 'E' | 'S' | 'W'; k: DecorationKind } => !!e.k && e.k !== kind)
			.map((e) => ({ edge: e.edge, color: TERRAIN_COLORS[e.k] }))
	);
</script>

<g transform="translate({x * TILE} {y * TILE})">
	<g in:placeIntro|local style="transform-box: fill-box; transform-origin: center;">
		{#if kind === 'grass'}
			<path d={blob.fill} fill={TERRAIN_COLORS.grass} />
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
		{:else if kind === 'stone'}
			<path d={blob.fill} fill={TERRAIN_COLORS.stone} />
			{#each stoneSpots(x, y) as spot, i (i)}
				<circle
					cx={spot.cx * TILE}
					cy={spot.cy * TILE}
					r={spot.r * TILE}
					fill={spot.tone > 0.55 ? '#71717a' : '#a1a1aa'}
				/>
			{/each}
		{/if}
		<!-- Neighbouring terrain of a different kind interlocks via a wavy band. -->
		{#each bleed as b (b.edge)}
			<path d={terrainEncroachBand(x, y, b.edge, TILE)} fill={b.color} fill-opacity="0.85" />
		{/each}
	</g>
</g>
