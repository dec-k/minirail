<script lang="ts">
	import { grid } from '$lib/railway/grid.svelte';
	import { treeSpots, buildingSpots, grassTufts, stoneSpots } from '$lib/railway/decorations';
	import { pathsOf } from '$lib/railway/pieces';
	import { isSwitch } from '$lib/railway/types';
	import { sleepers, RAIL_Y } from './geometry3d';
	import InstancedField from './InstancedField.svelte';
	import {
		type InstanceItem,
		trunkGeo,
		coneGeo,
		boxGeo,
		roofGeo,
		patchGeo,
		tuftGeo,
		pebbleGeo,
		sleeperGeo,
		trunkMat,
		foliageMat,
		bodyMat,
		roofMat,
		grassPatchMat,
		stonePatchMat,
		tuftMat,
		pebbleMat,
		waterMat,
		waterBedMat,
		sleeperMat,
		railMat,
		getRailGeo,
		railSig
	} from './instances';

	// All scenery is rebuilt only when the underlying grid maps change (edits),
	// never per frame — so this whole component is idle while a train runs.
	function parse<T>(map: Map<string, T>) {
		return [...map.entries()].map(([k, v]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, v };
		});
	}

	const decoEntries = $derived(parse(grid.decorations));
	const groundEntries = $derived(parse(grid.groundOvers));
	const cellEntries = $derived(parse(grid.cells));

	const treeTiles = $derived(decoEntries.filter((d) => d.v.kind === 'tree'));
	const buildingTiles = $derived(decoEntries.filter((d) => d.v.kind === 'building'));
	const waterTiles = $derived(decoEntries.filter((d) => d.v.kind === 'water'));
	const grassTiles = $derived(groundEntries.filter((d) => d.v.kind === 'grass'));
	const stoneTiles = $derived(groundEntries.filter((d) => d.v.kind === 'stone'));

	// --- trees: trunk + two foliage cones, sized by per-spot radius ---
	const trunks = $derived<InstanceItem[]>(
		treeTiles.flatMap(({ x, y }) =>
			treeSpots(x, y).map((t) => ({
				x: x + t.cx,
				y: t.r * 0.3,
				z: y + t.cy,
				sx: t.r,
				sy: t.r * 0.6,
				sz: t.r
			}))
		)
	);
	const lowerCones = $derived<InstanceItem[]>(
		treeTiles.flatMap(({ x, y }) =>
			treeSpots(x, y).map((t) => ({
				x: x + t.cx,
				y: t.r * 1.35,
				z: y + t.cy,
				sx: t.r * 0.95,
				sy: t.r * 1.5,
				sz: t.r * 0.95,
				color: t.tone > 0.5 ? '#3f6e2e' : '#467a35'
			}))
		)
	);
	const upperCones = $derived<InstanceItem[]>(
		treeTiles.flatMap(({ x, y }) =>
			treeSpots(x, y).map((t) => ({
				x: x + t.cx,
				y: t.r * 2.23,
				z: y + t.cy,
				sx: t.r * 0.7,
				sy: t.r * 1.1,
				sz: t.r * 0.7,
				color: t.tone > 0.5 ? '#5b9d47' : '#67a652'
			}))
		)
	);

	// --- buildings: box body + pyramid roof ---
	const bodies = $derived<InstanceItem[]>(
		buildingTiles.flatMap(({ x, y }) =>
			buildingSpots(x, y).map((b) => {
				const bodyH = b.size * 1.15;
				return {
					x: x + b.cx,
					y: bodyH / 2,
					z: y + b.cy,
					sx: b.size,
					sy: bodyH,
					sz: b.size,
					color: b.tone > 0.5 ? '#f0dfc2' : '#e0cfae'
				};
			})
		)
	);
	const roofs = $derived<InstanceItem[]>(
		buildingTiles.flatMap(({ x, y }) =>
			buildingSpots(x, y).map((b) => {
				const bodyH = b.size * 1.15;
				const roofH = b.size * 0.7;
				return {
					x: x + b.cx,
					y: bodyH + roofH / 2,
					z: y + b.cy,
					sx: b.size,
					sy: roofH,
					sz: b.size,
					color: b.roofTone < 0.34 ? '#a04d3a' : b.roofTone < 0.67 ? '#7a5535' : '#5a6072'
				};
			})
		)
	);

	// --- groundcover: flat patches + scatter ---
	const grassPatches = $derived<InstanceItem[]>(
		grassTiles.map(({ x, y }) => ({ x: x + 0.5, y: 0.014, z: y + 0.5 }))
	);
	const grassBlades = $derived<InstanceItem[]>(
		grassTiles.flatMap(({ x, y }) =>
			grassTufts(x, y).map((g) => ({
				x: x + g.cx,
				y: 0.045,
				z: y + g.cy,
				color: g.tone > 0.5 ? '#5f8f3a' : '#6fa548'
			}))
		)
	);
	const stonePatches = $derived<InstanceItem[]>(
		stoneTiles.map(({ x, y }) => ({ x: x + 0.5, y: 0.014, z: y + 0.5 }))
	);
	const pebbles = $derived<InstanceItem[]>(
		stoneTiles.flatMap(({ x, y }) =>
			stoneSpots(x, y).map((s) => ({
				x: x + s.cx,
				y: s.r * 0.45,
				z: y + s.cy,
				sx: s.r,
				sy: s.r,
				sz: s.r,
				ry: s.tone * 6,
				color: s.tone > 0.5 ? '#9a948a' : '#aaa499'
			}))
		)
	);
	// Opaque bed near ground level + translucent surface just above the grass patches
	// (0.014), so the pond no longer floats and shows a cream rim beneath its edge.
	const waterBed = $derived<InstanceItem[]>(
		waterTiles.map(({ x, y }) => ({ x: x + 0.5, y: 0.01, z: y + 0.5 }))
	);
	const water = $derived<InstanceItem[]>(
		waterTiles.map(({ x, y }) => ({ x: x + 0.5, y: 0.018, z: y + 0.5 }))
	);

	// --- track: sleepers (one field) + rails (grouped by path shape) ---
	const sleeperItems = $derived<InstanceItem[]>(
		cellEntries.flatMap(({ x, y, v: piece }) => {
			const sw = isSwitch(piece.kind);
			const ai = piece.active ?? 0;
			return pathsOf(piece).flatMap((p, i) => {
				const inactive = sw && i !== ai;
				return sleepers(p).map((s) => ({
					x: x + s.x,
					y: RAIL_Y * 0.5,
					z: y + s.z,
					ry: s.rotY,
					color: inactive ? '#9b8b6e' : '#5a3a1f'
				}));
			});
		})
	);

	const railGroups = $derived.by(() => {
		const groups = new Map<string, { geo: ReturnType<typeof getRailGeo>; items: InstanceItem[] }>();
		for (const { x, y, v: piece } of cellEntries) {
			const sw = isSwitch(piece.kind);
			const ai = piece.active ?? 0;
			pathsOf(piece).forEach((p, i) => {
				const color = sw && i !== ai ? '#b8b0a0' : '#8a8a92';
				for (const side of [1, -1] as const) {
					const sig = railSig(p, side);
					let g = groups.get(sig);
					if (!g) {
						g = { geo: getRailGeo(p, side), items: [] };
						groups.set(sig, g);
					}
					g.items.push({ x, y: 0, z: y, color });
				}
			});
		}
		return [...groups.entries()].map(([sig, g]) => ({ sig, geo: g.geo, items: g.items }));
	});
</script>

<InstancedField geometry={trunkGeo} material={trunkMat} items={trunks} castShadow />
<InstancedField geometry={coneGeo} material={foliageMat} items={lowerCones} castShadow />
<InstancedField geometry={coneGeo} material={foliageMat} items={upperCones} castShadow />

<InstancedField geometry={boxGeo} material={bodyMat} items={bodies} castShadow receiveShadow />
<InstancedField geometry={roofGeo} material={roofMat} items={roofs} castShadow />

<InstancedField geometry={patchGeo} material={grassPatchMat} items={grassPatches} receiveShadow />
<InstancedField geometry={tuftGeo} material={tuftMat} items={grassBlades} castShadow />
<InstancedField geometry={patchGeo} material={stonePatchMat} items={stonePatches} receiveShadow />
<InstancedField geometry={pebbleGeo} material={pebbleMat} items={pebbles} castShadow />
<InstancedField geometry={patchGeo} material={waterBedMat} items={waterBed} receiveShadow />
<InstancedField geometry={patchGeo} material={waterMat} items={water} receiveShadow />

<InstancedField
	geometry={sleeperGeo}
	material={sleeperMat}
	items={sleeperItems}
	castShadow
	receiveShadow
/>
{#each railGroups as g (g.sig)}
	<InstancedField geometry={g.geo} material={railMat} items={g.items} castShadow />
{/each}
