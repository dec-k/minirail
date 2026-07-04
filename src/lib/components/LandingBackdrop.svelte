<script lang="ts">
	import { grid, getPiece } from '$lib/railway/grid.svelte';
	import { sim } from '$lib/railway/sim.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import { sample } from '$lib/railway/geometry';
	import { walkers } from '$lib/railway/particles.svelte';
	import { personColor } from '$lib/railway/people';
	import { TILE } from './board/constants';
	import GroundOverTile from './board/GroundOverTile.svelte';
	import DecorationTile from './board/DecorationTile.svelte';
	import TrackTile from './board/TrackTile.svelte';
	import StationTile from './board/StationTile.svelte';
	import Vehicle from './board/Vehicle.svelte';
	import WalkerSprite from './board/WalkerSprite.svelte';

	// A fixed, zoomed-in window onto the world (in grid-tile units). Chosen to
	// frame the little village's central loops and running trains. The SVG uses
	// `slice` so this window is scaled to cover the viewport and cropped.
	const WINDOW = { x: 15, y: 8, w: 18, h: 12 };
	const viewBox = `${WINDOW.x * TILE} ${WINDOW.y * TILE} ${WINDOW.w * TILE} ${WINDOW.h * TILE}`;

	const cellEntries = $derived(
		[...grid.cells.entries()].map(([k, piece]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, piece };
		})
	);

	const stationEntries = $derived(
		[...grid.stations.entries()].map(([k, station]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, station };
		})
	);

	const decorationEntries = $derived(
		[...grid.decorations.entries()].map(([k, decoration]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, decoration };
		})
	);

	const groundOverEntries = $derived(
		[...grid.groundOvers.entries()].map(([k, groundOver]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, groundOver };
		})
	);

	function poseOf(v: { x: number; y: number; pathIdx: number; t: number; dir: 1 | -1 }) {
		const piece = getPiece(v.x, v.y);
		if (!piece) return null;
		const path = pathsOf(piece)[v.pathIdx];
		if (!path) return null;
		const s = sample(path, v.t);
		return {
			x: (v.x + s.x) * TILE,
			y: (v.y + s.y) * TILE,
			heading: (s.heading * 180) / Math.PI + (v.dir === -1 ? 180 : 0)
		};
	}

	type VehiclePose = {
		key: string;
		kind: 'loco' | 'wagon';
		color: string;
		occupantColor: string | null;
		x: number;
		y: number;
		heading: number;
	};

	const vehiclePoses = $derived.by(() => {
		const out: VehiclePose[] = [];
		for (const l of sim.locos) {
			const lp = poseOf(l);
			if (lp)
				out.push({
					key: `loco-${l.id}`,
					kind: 'loco',
					color: l.color,
					occupantColor: null,
					...lp
				});
			for (let i = 0; i < l.wagons.length; i++) {
				const wp = poseOf(l.wagons[i]);
				if (wp)
					out.push({
						key: `wagon-${l.id}-${i}`,
						kind: 'wagon',
						color: l.color,
						occupantColor: i < l.passengers.length ? personColor(l.passengers[i]) : null,
						...wp
					});
			}
		}
		return out;
	});
</script>

<svg
	class="absolute inset-0 h-full w-full select-none"
	{viewBox}
	preserveAspectRatio="xMidYMid slice"
	role="presentation"
	aria-hidden="true"
>
	{#each groundOverEntries as { x, y, groundOver } (`ground-${x},${y}`)}
		<GroundOverTile {x} {y} kind={groundOver.kind} />
	{/each}

	{#each decorationEntries as { x, y, decoration } (`deco-${x},${y}`)}
		<DecorationTile {x} {y} kind={decoration.kind} />
	{/each}

	{#each cellEntries as { x, y, piece } (`${x},${y}`)}
		<TrackTile {x} {y} {piece} />
	{/each}

	{#each stationEntries as { x, y, station } (`station-${x},${y}`)}
		<StationTile {x} {y} {station} />
	{/each}

	{#each vehiclePoses as pose (pose.key)}
		<Vehicle
			kind={pose.kind}
			color={pose.color}
			occupantColor={pose.occupantColor}
			x={pose.x}
			y={pose.y}
			heading={pose.heading}
		/>
	{/each}

	{#each walkers.list as walker (walker.id)}
		<WalkerSprite {walker} />
	{/each}
</svg>
