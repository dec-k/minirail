<script lang="ts">
	import type { Walker } from '$lib/railway/particles.svelte';
	import { TILE } from './constants';

	let { walker }: { walker: Walker } = $props();

	// Smoothstep the platform↔train walk so people ease out of a stand and
	// settle at the far end instead of gliding linearly.
	const p = $derived(Math.min(1, walker.life / walker.maxLife));
	const eased = $derived(p * p * (3 - 2 * p));
	const wx = $derived((walker.x0 + (walker.x1 - walker.x0) * eased) * TILE);
	const wy = $derived((walker.y0 + (walker.y1 - walker.y0) * eased) * TILE);
	// Two little hops over the course of the walk read as footsteps.
	const bob = $derived(-Math.abs(Math.sin(p * Math.PI * 2)) * TILE * 0.02);
</script>

<g transform="translate({wx} {wy})">
	<ellipse cy={TILE * 0.05} rx={TILE * 0.042} ry={TILE * 0.016} fill="#000" fill-opacity="0.15" />
	<ellipse
		cy={bob}
		rx={TILE * 0.042}
		ry={TILE * 0.052}
		fill={walker.color}
		stroke="rgba(0,0,0,0.35)"
		stroke-width="0.6"
	/>
	<circle
		cy={bob - TILE * 0.06}
		r={TILE * 0.032}
		fill="#fbe49d"
		stroke="#7a5535"
		stroke-width="0.6"
	/>
</g>
