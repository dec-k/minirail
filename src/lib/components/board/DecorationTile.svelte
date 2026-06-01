<script lang="ts">
	import { getDecoration, getGroundOver } from '$lib/railway/grid.svelte';
	import {
		buildingSpots,
		treeSpots,
		waveGlints,
		terrainBlob,
		terrainEncroachBand,
		TERRAIN_COLORS
	} from '$lib/railway/decorations';
	import type { DecorationKind } from '$lib/railway/types';
	import { TILE, placeIntro } from './constants';

	let { x, y, kind }: { x: number; y: number; kind: DecorationKind } = $props();

	// Grass/stone neighbour terrain bleeding into this water tile per edge. Only
	// applies on a true shoreline edge (neighbour is land, not more water) —
	// otherwise a grass field sitting *under* the water would paint seams between
	// adjacent water tiles.
	const isLand = (k?: DecorationKind): k is 'grass' | 'stone' => k === 'grass' || k === 'stone';
	const bleed = $derived(
		kind === 'water'
			? (
					[
						['N', 0, -1],
						['E', 1, 0],
						['S', 0, 1],
						['W', -1, 0]
					] as const
				)
					.filter(
						([, dx, dy]) =>
							getDecoration(x + dx, y + dy)?.kind !== 'water' &&
							isLand(getGroundOver(x + dx, y + dy)?.kind)
					)
					.map(([edge, dx, dy]) => ({
						edge,
						color: TERRAIN_COLORS[getGroundOver(x + dx, y + dy)!.kind as 'grass' | 'stone']
					}))
			: []
	);
</script>

<g transform="translate({x * TILE} {y * TILE})">
	<g in:placeIntro|local style="transform-box: fill-box; transform-origin: center;">
		{#if kind === 'water'}
			{@const blob = terrainBlob(
				x,
				y,
				{
					n: getDecoration(x, y - 1)?.kind === 'water',
					e: getDecoration(x + 1, y)?.kind === 'water',
					s: getDecoration(x, y + 1)?.kind === 'water',
					w: getDecoration(x - 1, y)?.kind === 'water'
				},
				TILE
			)}
			<path d={blob.fill} fill={TERRAIN_COLORS.water} />
			<!-- Adjacent grass/stone encroaches a short, wavy-bordered band into the water. -->
			{#each bleed as b (b.edge)}
				<path d={terrainEncroachBand(x, y, b.edge, TILE)} fill={b.color} fill-opacity="0.85" />
			{/each}
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
			<!-- Shoreline highlight following the organic outline (exposed edges only). -->
			<path
				d={blob.shore}
				fill="none"
				stroke="#d9eef9"
				stroke-opacity="0.9"
				stroke-width={2.5}
				stroke-linecap="round"
			/>
		{:else if kind === 'tree'}
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
		{:else if kind === 'building'}
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
				{@const roof = h.roofTone < 0.34 ? '#a04d3a' : h.roofTone < 0.67 ? '#7a5535' : '#5a6072'}
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
					points="{bodyLeft - overhang},{bodyTop} {bodyRight + overhang},{bodyTop} {cx},{roofPeak}"
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
