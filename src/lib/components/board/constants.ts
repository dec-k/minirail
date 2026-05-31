import { scale } from 'svelte/transition';
import { backOut } from 'svelte/easing';
import { placementFx } from '$lib/railway/grid.svelte';

export const TILE = 56;

// Snap a freshly placed tile in with a small overshoot. Returns a no-op when
// `placementFx.suppressIntro` is set (bulk loads via applyLayout) so the
// transition doesn't fire dozens of times at once.
export function placeIntro(node: SVGElement) {
	if (placementFx.suppressIntro) return {};
	return scale(node, { start: 0.7, opacity: 0.4, duration: 220, easing: backOut });
}
