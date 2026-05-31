<script lang="ts">
	import { pathsOf } from '$lib/railway/pieces';
	import { sample, svgPathD } from '$lib/railway/geometry';
	import { isSwitch, type Piece, type TilePath } from '$lib/railway/types';
	import { TILE, placeIntro } from './constants';

	let { x, y, piece }: { x: number; y: number; piece: Piece } = $props();

	type SleeperTick = { cx: number; cy: number; nx: number; ny: number };

	function sleeperTicks(path: TilePath, count: number, halfLen: number): SleeperTick[] {
		const out: SleeperTick[] = [];
		for (let i = 0; i < count; i++) {
			const t = (i + 0.5) / count;
			const s = sample(path, t);
			out.push({
				cx: s.x * TILE,
				cy: s.y * TILE,
				nx: -Math.sin(s.heading) * halfLen,
				ny: Math.cos(s.heading) * halfLen
			});
		}
		return out;
	}

	const switchTile = $derived(isSwitch(piece.kind));
	const activeIdx = $derived(piece.active ?? 0);
	const ordered = $derived(
		pathsOf(piece)
			.map((p, i) => ({ p, i, inactive: switchTile && i !== activeIdx }))
			.sort((a, b) => Number(b.inactive) - Number(a.inactive))
	);
</script>

<g transform="translate({x * TILE} {y * TILE})">
	<g in:placeIntro|local style="transform-box: fill-box; transform-origin: center;">
		<rect width={TILE} height={TILE} class="fill-foreground/3" />
		{#each ordered as { p, i, inactive } (i)}
			<path
				d={svgPathD(p, TILE)}
				fill="none"
				stroke={inactive ? '#d6cdb8' : '#c8a878'}
				stroke-width={Math.round(TILE * 0.46)}
				stroke-linecap="butt"
				opacity={inactive ? 0.65 : 1}
			/>
			{#each sleeperTicks(p, 5, TILE * 0.21) as tick, k (k)}
				<line
					x1={tick.cx - tick.nx}
					y1={tick.cy - tick.ny}
					x2={tick.cx + tick.nx}
					y2={tick.cy + tick.ny}
					stroke={inactive ? '#9b8b6e' : '#5a3a1f'}
					stroke-width={Math.max(2, Math.round(TILE * 0.07))}
					stroke-linecap="round"
					opacity={inactive ? 0.55 : 0.92}
				/>
			{/each}
			<path
				d={svgPathD(p, TILE)}
				fill="none"
				class={inactive ? 'stroke-track-inactive' : 'stroke-track-active'}
				stroke-width={Math.round(TILE * 0.22)}
				stroke-linecap="butt"
				opacity={inactive ? 0.6 : 1}
			/>
			<path
				d={svgPathD(p, TILE)}
				fill="none"
				stroke={inactive ? '#d6cdb8' : '#c8a878'}
				stroke-width={Math.round(TILE * 0.12)}
				stroke-linecap="butt"
				opacity={inactive ? 0.7 : 1}
			/>
		{/each}
		{#if switchTile}
			<circle
				cx={TILE / 2}
				cy={TILE / 2}
				r={Math.max(3, Math.round(TILE * 0.075))}
				class="fill-switch-marker"
			/>
		{/if}
	</g>
</g>
