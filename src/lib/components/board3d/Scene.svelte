<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
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
	import Scenery3D from './Scenery3D.svelte';
	import Station3D from './Station3D.svelte';
	import Vehicle3D from './Vehicle3D.svelte';
	import Postprocessing from './Postprocessing.svelte';
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

	// Theme-aware sky + fog. Watches the <html> .dark class so the diorama
	// backdrop tracks the app's light/dark mode. A vertical gradient reads as a
	// soft sky; distance fog matched to the horizon colour melts the (enlarged)
	// far ground into it for depth.
	const { scene } = useThrelte();
	let dark = $state(false);
	$effect(() => {
		const el = document.documentElement;
		const sync = () => (dark = el.classList.contains('dark'));
		sync();
		const obs = new MutationObserver(sync);
		obs.observe(el, { attributes: true, attributeFilter: ['class'] });
		return () => obs.disconnect();
	});

	const groundColor = $derived(dark ? '#39414e' : '#e9e4d8');
	const groundSize = $derived(Math.max(w, h) * 8);

	function gradientTexture(top: string, bottom: string) {
		const c = document.createElement('canvas');
		c.width = 2;
		c.height = 256;
		const ctx = c.getContext('2d')!;
		const grad = ctx.createLinearGradient(0, 0, 0, 256);
		grad.addColorStop(0, top);
		grad.addColorStop(1, bottom);
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, 2, 256);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	$effect(() => {
		const sky = dark
			? { top: '#0f1622', bottom: '#28323f' }
			: { top: '#9fc4e8', bottom: '#e6eef4' };
		const fogColor = dark ? '#28323f' : '#e6eef4';
		const tex = gradientTexture(sky.top, sky.bottom);
		scene.background = tex;
		scene.fog = new THREE.Fog(fogColor, 55, 170);
		return () => {
			tex.dispose();
			scene.background = null;
			scene.fog = null;
		};
	});

	// Soft, slightly irregular puff texture shared by every steam sprite — a few
	// overlapping radial gradients read as billowing vapour instead of a hard
	// sphere, and one shared texture keeps it cheap. White so each sprite can be
	// tinted per-puff.
	function smokeTexture() {
		const c = document.createElement('canvas');
		c.width = c.height = 64;
		const ctx = c.getContext('2d')!;
		const blob = (cx: number, cy: number, r: number, a: number) => {
			const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
			g.addColorStop(0, `rgba(255,255,255,${a})`);
			g.addColorStop(0.6, `rgba(255,255,255,${a * 0.4})`);
			g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 64, 64);
		};
		blob(32, 32, 30, 0.9);
		blob(24, 27, 17, 0.5);
		blob(41, 37, 15, 0.5);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}
	let smokeTex = $state<THREE.Texture>();
	$effect(() => {
		const tex = smokeTexture();
		smokeTex = tex;
		return () => tex.dispose();
	});

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
	<!-- Right-drag orbits, middle-drag pans, wheel zooms. Selecting the Pan tool
		 also lets left-drag pan (editing is disabled for that tool anyway), matching
		 the 2D board. Touch: one finger orbits, two fingers pan + pinch-zoom. -->
	<OrbitControls
		enableDamping
		enablePan
		dampingFactor={0.08}
		minDistance={8}
		maxDistance={70}
		maxPolarAngle={Math.PI * 0.49}
		mouseButtons={{
			LEFT: tool === 'pan' ? THREE.MOUSE.PAN : undefined,
			MIDDLE: THREE.MOUSE.PAN,
			RIGHT: THREE.MOUSE.ROTATE
		}}
	/>
</T.PerspectiveCamera>

<Postprocessing />

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
	<!-- Ground plane: enlarged so its edges fade into the fog instead of showing a
		 hard slab edge. Still the only interactive mesh, so every click resolves to
		 a cell via its world hit point regardless of what's drawn on top. -->
	<T.Mesh
		rotation.x={-Math.PI / 2}
		position={[w / 2, 0, h / 2]}
		receiveShadow
		onclick={onGroundClick}
	>
		<T.PlaneGeometry args={[groundSize, groundSize]} />
		<T.MeshStandardMaterial color={groundColor} roughness={1} />
	</T.Mesh>

	<T.LineSegments geometry={gridLines}>
		<T.LineBasicMaterial color="#cfcabb" transparent opacity={0.8} />
	</T.LineSegments>

	<!-- All track + scenery, GPU-instanced (a handful of draw calls total). -->
	<Scenery3D />

	{#each stationEntries as { x, y, station } (`station-${x},${y}`)}
		<Station3D {x} {y} {station} />
	{/each}

	{#each vehiclePoses as p (p.key)}
		<Vehicle3D kind={p.kind} color={p.color} occupied={p.occupied} x={p.x} z={p.z} rotY={p.rotY} />
	{/each}

	<!-- Steam puffs: grid-coord particles owned by the sim loop. Drawn as
		 camera-facing sprites with a soft puff texture — they grow and rise over
		 their life, fade in then out, spin slowly, and lighten from a sooty grey
		 at the funnel to near-white as they dissipate. Emitted just above the
		 funnel top (~0.53) so they no longer clip into the chimney. -->
	{#if smokeTex}
		{#each particles.list as pt (pt.id)}
			{@const t = Math.min(1, pt.life / pt.maxLife)}
			{@const r = 0.16 + t * 0.42}
			{@const op = Math.sin(t * Math.PI) * 0.45}
			{@const sh = 205 + Math.round(t * 42)}
			<T.Sprite position={[pt.x, 0.58 + t * 0.6, pt.y]} scale={[r, r, r]}>
				<T.SpriteMaterial
					map={smokeTex}
					color={`rgb(${sh},${sh},${sh + 4})`}
					transparent
					opacity={op}
					depthWrite={false}
					rotation={pt.id * 1.7 + pt.life * 0.5}
				/>
			</T.Sprite>
		{/each}
	{/if}
</T.Group>
