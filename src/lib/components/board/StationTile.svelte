<script lang="ts">
	import { getPiece } from '$lib/railway/grid.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import type { Station } from '$lib/railway/types';
	import { TILE } from './constants';

	let { x, y, station }: { x: number; y: number; station: Station } = $props();

	// Pick which edge of the tile to render the platform on. Stations only exist
	// on cells with track; if the tile's path is purely vertical (N↔S) the
	// platform goes on the east edge to sit alongside the rails, otherwise on
	// the south edge.
	function platformOrientation(): 'south' | 'east' {
		const piece = getPiece(x, y);
		if (!piece) return 'south';
		const paths = pathsOf(piece);
		if (paths.length === 0) return 'south';
		for (const p of paths) {
			if (p.from === 1 || p.from === 3 || p.to === 1 || p.to === 3) return 'south';
		}
		return 'east';
	}

	const orient = $derived(platformOrientation());
	const hasPeople = $derived(station.peopleWaiting > 0);
	const headCount = $derived(Math.min(station.peopleWaiting, 5));
</script>

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
		<g class="standee" style="--pop: 1.3; --rise: 4px;">
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
		</g>
		{#each Array.from({ length: headCount }), pi (pi)}
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
		<g class="standee" style="--pop: 1.3; --rise: 4px;">
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
		</g>
		{#each Array.from({ length: headCount }), pi (pi)}
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
	<g class="standee" style="--pop: 1.35; --rise: 6px;">
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
</g>
