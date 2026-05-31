<script lang="ts">
	import { TILE } from './constants';

	let {
		x,
		y,
		passengers,
		capacity,
		boarding
	}: {
		x: number;
		y: number;
		passengers: number;
		capacity: number;
		boarding: boolean;
	} = $props();
</script>

<g transform="translate({x} {y - TILE * 0.45})">
	<rect
		x={-TILE * 0.22}
		y={-TILE * 0.13}
		width={TILE * 0.44}
		height={TILE * 0.24}
		rx={TILE * 0.05}
		fill={boarding ? '#10b981' : '#1e293b'}
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
		{passengers}/{capacity}
	</text>
</g>
