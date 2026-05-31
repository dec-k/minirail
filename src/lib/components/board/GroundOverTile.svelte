<script lang="ts">
	import { grassTufts, stoneSpots } from '$lib/railway/decorations';
	import type { DecorationKind } from '$lib/railway/types';
	import { TILE, placeIntro } from './constants';

	let { x, y, kind }: { x: number; y: number; kind: DecorationKind } = $props();
</script>

<g transform="translate({x * TILE} {y * TILE})">
	<g in:placeIntro|local style="transform-box: fill-box; transform-origin: center;">
		{#if kind === 'grass'}
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
		{:else if kind === 'stone'}
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
