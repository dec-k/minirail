<script lang="ts">
	import { grid } from '$lib/railway/grid.svelte';
	import { atmosphere, type TimeOfDay } from '$lib/railway/atmosphere.svelte';
	import { TILE } from './constants';

	type LocoLight = { key: string; x: number; y: number; heading: number };

	let {
		widthPx,
		heightPx,
		locoLights
	}: { widthPx: number; heightPx: number; locoLights: LocoLight[] } = $props();

	// Lighting recipe per time of day: how much to darken the world, what colour
	// that darkness is, and how strongly the lamps/windows glow. Switching time
	// retargets these and the CSS transitions below cross-fade between them.
	const RECIPES: Record<TimeOfDay, { dark: number; tint: string; lamp: number }> = {
		day: { dark: 0, tint: '#0d1538', lamp: 0 },
		dusk: { dark: 0.4, tint: '#3a1f4d', lamp: 0.7 },
		night: { dark: 0.64, tint: '#0d1538', lamp: 1 },
		dawn: { dark: 0.32, tint: '#243a63', lamp: 0.55 }
	};

	const recipe = $derived(RECIPES[atmosphere.timeOfDay]);

	// Tiles that emit warm light after dark: lit windows of buildings and the
	// glow of station lamps. Centres in pixels.
	const litTiles = $derived.by(() => {
		const out: { key: string; cx: number; cy: number; r: number }[] = [];
		for (const [k, d] of grid.decorations) {
			if (d.kind !== 'building') continue;
			const [x, y] = k.split(',').map(Number);
			out.push({ key: `b-${k}`, cx: (x + 0.5) * TILE, cy: (y + 0.5) * TILE, r: TILE * 0.7 });
		}
		for (const k of grid.stations.keys()) {
			const [x, y] = k.split(',').map(Number);
			out.push({ key: `s-${k}`, cx: (x + 0.5) * TILE, cy: (y + 0.2) * TILE, r: TILE * 0.55 });
		}
		return out;
	});

	// Headlamp beam, pointing along the loco's local +x axis. Apex just ahead of
	// the loco, fanning out into the dark.
	const CONE_NEAR = TILE * 0.3;
	const CONE_FAR = TILE * 2.7;
	const CONE_HALF = TILE * 0.95;
	const conePath = `M ${CONE_NEAR} 0 L ${CONE_FAR} ${-CONE_HALF} L ${CONE_FAR * 1.04} 0 L ${CONE_FAR} ${CONE_HALF} Z`;
</script>

<div
	class="pointer-events-none absolute top-0 left-0"
	style="width: {widthPx}px; height: {heightPx}px;"
>
	<!-- Darkening + vignette, multiplied onto the world below. -->
	<svg
		viewBox="0 0 {widthPx} {heightPx}"
		width={widthPx}
		height={heightPx}
		class="absolute top-0 left-0 block"
		style="mix-blend-mode: multiply;"
		role="presentation"
	>
		<defs>
			<radialGradient id="vignette" cx="50%" cy="50%" r="72%">
				<stop offset="55%" stop-color="#ffffff" />
				<stop offset="100%" stop-color="#c9ccd6" />
			</radialGradient>
		</defs>
		<rect width={widthPx} height={heightPx} fill="url(#vignette)" />
		<rect
			class="night-dark"
			width={widthPx}
			height={heightPx}
			style="fill: {recipe.tint}; opacity: {recipe.dark};"
		/>
	</svg>

	<!-- Additive light sources, screened over the darkened world. -->
	<svg
		viewBox="0 0 {widthPx} {heightPx}"
		width={widthPx}
		height={heightPx}
		class="absolute top-0 left-0 block"
		style="mix-blend-mode: screen;"
		role="presentation"
	>
		<defs>
			<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0%" stop-color="#fff6d8" stop-opacity="0.85" />
				<stop offset="55%" stop-color="#ffe9a8" stop-opacity="0.28" />
				<stop offset="100%" stop-color="#ffe9a8" stop-opacity="0" />
			</linearGradient>
			<radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="#fff7df" stop-opacity="0.95" />
				<stop offset="100%" stop-color="#fff7df" stop-opacity="0" />
			</radialGradient>
			<radialGradient id="windowGlow" cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="#ffcf7a" stop-opacity="0.85" />
				<stop offset="60%" stop-color="#ffb347" stop-opacity="0.3" />
				<stop offset="100%" stop-color="#ffb347" stop-opacity="0" />
			</radialGradient>
		</defs>

		<g class="lit" style="opacity: {recipe.lamp};">
			{#each litTiles as t (t.key)}
				<circle cx={t.cx} cy={t.cy} r={t.r} fill="url(#windowGlow)" />
			{/each}
		</g>

		<g class="lit" style="opacity: {recipe.lamp};">
			{#each locoLights as l (l.key)}
				<g transform="translate({l.x} {l.y}) rotate({l.heading})">
					<path d={conePath} fill="url(#beam)" />
					<circle cx={CONE_NEAR} cy="0" r={TILE * 0.4} fill="url(#lampGlow)" />
				</g>
			{/each}
		</g>
	</svg>
</div>

<style>
	/* Cross-fade the darkness tint and the lamp glow when the user picks a new
	   time of day, instead of snapping. */
	.night-dark {
		transition:
			opacity 1.1s ease,
			fill 1.1s ease;
	}
	.lit {
		transition: opacity 1.1s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.night-dark,
		.lit {
			transition: none;
		}
	}
</style>
