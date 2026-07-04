<script lang="ts">
	import { hash2 } from '$lib/railway/decorations';
	import { personColor, platformSide } from '$lib/railway/people';
	import { cellKey, type Station } from '$lib/railway/types';
	import { TILE } from './constants';

	let { x, y, station }: { x: number; y: number; station: Station } = $props();

	const orient = $derived(platformSide(x, y));
	const stationColor = $derived(personColor(cellKey(x, y)));

	// The crowd IS the counter: up to five standees on the platform, plus a
	// small "+N" once the queue outgrows the space for individuals.
	const MAX_STANDEES = 5;
	const headCount = $derived(Math.min(station.peopleWaiting, MAX_STANDEES));
	const overflow = $derived(station.peopleWaiting - headCount);

	// Deterministic per-person jitter so the queue looks like a loose huddle
	// rather than beads on a wire, but doesn't shuffle between renders.
	function jitter(i: number, salt: number): number {
		return (hash2(x, y, i * 7 + salt) - 0.5) * 0.03;
	}

	// Standee positions in tile-local coords: a row along the south platform,
	// or a column down the east one.
	const standees = $derived(
		Array.from({ length: headCount }, (_, i) =>
			orient === 'south'
				? { px: 0.16 + i * 0.17 + jitter(i, 1), py: 0.875 + jitter(i, 2) }
				: { px: 0.86 + jitter(i, 1), py: 0.44 + i * 0.115 + jitter(i, 2) }
		)
	);
</script>

{#snippet standee(px: number, py: number)}
	<ellipse
		cx={px * TILE}
		cy={(py + 0.05) * TILE}
		rx={TILE * 0.042}
		ry={TILE * 0.016}
		fill="#000"
		fill-opacity="0.15"
	/>
	<ellipse
		cx={px * TILE}
		cy={py * TILE}
		rx={TILE * 0.042}
		ry={TILE * 0.052}
		fill={stationColor}
		stroke="rgba(0,0,0,0.35)"
		stroke-width="0.6"
	/>
	<circle
		cx={px * TILE}
		cy={(py - 0.06) * TILE}
		r={TILE * 0.032}
		fill="#fbe49d"
		stroke="#7a5535"
		stroke-width="0.6"
	/>
{/snippet}

{#snippet overflowLabel(tx: number, ty: number, anchor: 'middle' | 'end')}
	<text
		x={tx * TILE}
		y={ty * TILE}
		text-anchor={anchor}
		dominant-baseline="middle"
		font-size={TILE * 0.13}
		font-weight="700"
		fill="#475569"
		style="paint-order: stroke; stroke: rgba(255,255,255,0.7); stroke-width: 2;"
	>
		+{overflow}
	</text>
{/snippet}

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
			fill={stationColor}
			stroke="#3a2a1a"
			stroke-width="0.6"
		/>
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
			fill={stationColor}
			stroke="#3a2a1a"
			stroke-width="0.6"
		/>
	{/if}
	{#each standees as s, pi (pi)}
		{@render standee(s.px, s.py)}
	{/each}
	{#if overflow > 0}
		{#if orient === 'south'}
			{@render overflowLabel(0.93, 0.885, 'end')}
		{:else}
			{@render overflowLabel(0.85, 0.39, 'middle')}
		{/if}
	{/if}
</g>
