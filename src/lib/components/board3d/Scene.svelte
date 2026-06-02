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
	import { sim, placeLoco, kickSimulation } from '$lib/railway/sim.svelte';
	import { particles } from '$lib/railway/particles.svelte';
	import { sample } from '$lib/railway/geometry';
	import { pathsOf } from '$lib/railway/pieces';
	import { isSwitch, type DecorationKind, type PieceKind } from '$lib/railway/types';
	import Track3D from './Track3D.svelte';
	import Decoration3D from './Decoration3D.svelte';
	import GroundOver3D from './GroundOver3D.svelte';
	import Station3D from './Station3D.svelte';
	import Vehicle3D from './Vehicle3D.svelte';
	import { gridLinesGeometry } from './geometry3d';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan';

	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();

	// Enables pointer events on meshes that declare handlers (the ground plane).
	interactivity();

	const w = $derived(grid.width);
	const h = $derived(grid.height);

	// The sun. Its shadow camera must be widened to cover the whole board AND have
	// updateProjectionMatrix() called — three.js won't pick up changed ortho
	// bounds otherwise, leaving the default ~±5 frustum (the reason no shadows
	// showed across the board). normalBias kills acne on the box/cone faces;
	// radius softens the edges (PCFSoft shadow map).
	let sun: THREE.DirectionalLight | undefined = $state();
	$effect(() => {
		if (!sun) return;
		const half = Math.max(w, h) / 2 + 4;
		const cam = sun.shadow.camera;
		cam.left = -half;
		cam.right = half;
		cam.top = half;
		cam.bottom = -half;
		cam.near = 1;
		cam.far = 140;
		cam.updateProjectionMatrix();
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.bias = -0.0003;
		sun.shadow.normalBias = 0.04;
		sun.shadow.radius = 4;
		sun.shadow.needsUpdate = true;
	});

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

	// Vehicle poses, sampled from the same path geometry the SVG board uses but in
	// grid units. rotation.y = -heading turns a body's +X axis onto the travel
	// direction; reversing adds 180°.
	function poseOf(v: { x: number; y: number; pathIdx: number; t: number; dir: 1 | -1 }) {
		const piece = getPiece(v.x, v.y);
		if (!piece) return null;
		const path = pathsOf(piece)[v.pathIdx];
		if (!path) return null;
		const s = sample(path, v.t);
		return { x: v.x + s.x, z: v.y + s.y, rotY: -s.heading + (v.dir === -1 ? Math.PI : 0) };
	}

	const vehiclePoses = $derived.by(() => {
		const out: {
			key: string;
			kind: 'loco' | 'wagon';
			color: string;
			occupied: boolean;
			x: number;
			z: number;
			rotY: number;
		}[] = [];
		for (const l of sim.locos) {
			const lp = poseOf(l);
			if (lp)
				out.push({ key: `loco-${l.id}`, kind: 'loco', color: l.color, occupied: false, ...lp });
			for (let i = 0; i < l.wagons.length; i++) {
				const wp = poseOf(l.wagons[i]);
				if (wp)
					out.push({
						key: `wagon-${l.id}-${i}`,
						kind: 'wagon',
						color: l.color,
						occupied: i < l.passengers.length,
						...wp
					});
			}
		}
		return out;
	});

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

<!-- Sky/ground hemisphere is the main fill (cool sky above, warm bounce below),
	 with just a touch of flat ambient to keep deep shadows from going black. The
	 warm directional sun does the actual shaping and casts the shadows. -->
<T.AmbientLight intensity={0.18} />
<T.HemisphereLight intensity={0.85} color="#bcd4ff" groundColor="#8f8262" />
<T.DirectionalLight
	bind:ref={sun}
	position={[24, 32, 16]}
	intensity={2.7}
	color="#fff1da"
	castShadow
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

	{#each vehiclePoses as p (p.key)}
		<Vehicle3D kind={p.kind} color={p.color} occupied={p.occupied} x={p.x} z={p.z} rotY={p.rotY} />
	{/each}

	<!-- Steam puffs: grid-coord particles owned by the sim loop. They rise in Y
		 over their life and fade out, drawn unlit so they read as light vapour. -->
	{#each particles.list as pt (pt.id)}
		{@const t = Math.min(1, pt.life / pt.maxLife)}
		{@const r = 0.1 + t * 0.22}
		<T.Mesh position={[pt.x, 0.42 + t * 0.5, pt.y]} scale={r}>
			<T.SphereGeometry args={[1, 8, 8]} />
			<T.MeshBasicMaterial color="#ffffff" transparent opacity={(1 - t) * 0.5} depthWrite={false} />
		</T.Mesh>
	{/each}
</T.Group>
