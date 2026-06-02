<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls, interactivity, type IntersectionEvent } from '@threlte/extras';
	import * as THREE from 'three';
	import {
		grid,
		getPiece,
		placePiece,
		rotateAt,
		removeAt,
		toggleAt,
		toggleStationAt,
		placeDecoration
	} from '$lib/railway/grid.svelte';
	import { placeLoco, kickSimulation } from '$lib/railway/sim.svelte';
	import { isSwitch, type DecorationKind, type PieceKind } from '$lib/railway/types';
	import Track3D from './Track3D.svelte';
	import Decoration3D from './Decoration3D.svelte';
	import GroundOver3D from './GroundOver3D.svelte';
	import Station3D from './Station3D.svelte';
	import { gridLinesGeometry } from './geometry3d';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan';

	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();

	// Enables pointer events on meshes that declare handlers (the ground plane).
	interactivity();

	const w = $derived(grid.width);
	const h = $derived(grid.height);

	const cellEntries = $derived(
		[...grid.cells.entries()].map(([k, piece]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, piece };
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

	const stationEntries = $derived(
		[...grid.stations.entries()].map(([k, station]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, station };
		})
	);

	const gridLines = $derived(gridLinesGeometry(w, h));

	// Mirrors Board.svelte's click handler. Raycasting replaces getScreenCTM, so
	// this works at any camera angle.
	function editAt(x: number, y: number, shift: boolean) {
		const existing = getPiece(x, y);
		if (shift) {
			if (existing && isSwitch(existing.kind)) toggleAt(x, y);
			return;
		}
		if (tool === 'pan') return;
		if (tool === 'erase') {
			removeAt(x, y);
			return;
		}
		if (tool === 'loco') {
			placeLoco(x, y);
			return;
		}
		if (tool === 'station') {
			toggleStationAt(x, y);
			kickSimulation();
			return;
		}
		if (tool === 'decorate') {
			placeDecoration(x, y, decorationKind);
			return;
		}
		// Piece tools. 'draw' has no drag equivalent in 3D yet (Stage 4), so a
		// click lays a straight as a stand-in.
		const kind: PieceKind = tool === 'draw' ? 'straight' : (tool as PieceKind);
		if (existing && existing.kind === kind) rotateAt(x, y);
		else placePiece(x, y, kind);
	}

	function onGroundClick(e: IntersectionEvent<MouseEvent>) {
		const p = e.point; // world-space hit point
		const x = Math.floor(p.x + w / 2);
		const y = Math.floor(p.z + h / 2);
		if (x < 0 || x >= w || y < 0 || y >= h) return;
		e.stopPropagation();
		editAt(x, y, e.nativeEvent.shiftKey);
	}
</script>

<T.PerspectiveCamera makeDefault position={[0, 30, 36]} fov={45}>
	<OrbitControls
		enableDamping
		dampingFactor={0.08}
		minDistance={8}
		maxDistance={70}
		maxPolarAngle={Math.PI * 0.49}
		mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
	/>
</T.PerspectiveCamera>

<T.AmbientLight intensity={1.1} />
<T.HemisphereLight intensity={0.5} groundColor="#b9b09c" />
<T.DirectionalLight
	position={[18, 34, 12]}
	intensity={2.2}
	castShadow
	shadow.mapSize.width={2048}
	shadow.mapSize.height={2048}
	shadow.camera.near={1}
	shadow.camera.far={120}
	shadow.camera.left={-32}
	shadow.camera.right={32}
	shadow.camera.top={32}
	shadow.camera.bottom={-32}
	shadow.bias={-0.0004}
/>

<!-- Board content, centred on the origin so OrbitControls orbits the middle. -->
<T.Group position={[-w / 2, 0, -h / 2]}>
	<!-- Ground plane: the only interactive mesh, so every click resolves to a
		 cell via its world hit point regardless of what's drawn on top. -->
	<T.Mesh
		rotation.x={-Math.PI / 2}
		position={[w / 2, 0, h / 2]}
		receiveShadow
		onclick={onGroundClick}
	>
		<T.PlaneGeometry args={[w, h]} />
		<T.MeshStandardMaterial color="#e9e4d8" roughness={1} />
	</T.Mesh>

	<T.LineSegments geometry={gridLines}>
		<T.LineBasicMaterial color="#cfcabb" transparent opacity={0.8} />
	</T.LineSegments>

	{#each groundOverEntries as { x, y, groundOver } (`ground-${x},${y}`)}
		<GroundOver3D {x} {y} kind={groundOver.kind} />
	{/each}

	{#each decorationEntries as { x, y, decoration } (`deco-${x},${y}`)}
		<Decoration3D {x} {y} kind={decoration.kind} />
	{/each}

	{#each cellEntries as { x, y, piece } (`${x},${y}`)}
		<Track3D {x} {y} {piece} />
	{/each}

	{#each stationEntries as { x, y, station } (`station-${x},${y}`)}
		<Station3D {x} {y} {station} />
	{/each}
</T.Group>
