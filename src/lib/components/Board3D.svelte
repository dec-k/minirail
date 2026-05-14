<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import * as THREE from 'three';
	import { mode } from 'mode-watcher';
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
	import { pathsOf } from '$lib/railway/pieces';
	import { sample, isStraight } from '$lib/railway/geometry';
	import {
		isSwitch,
		cellKey,
		type DecorationKind,
		type PieceKind,
		type TilePath
	} from '$lib/railway/types';
	import { stoneSpots, treeSpots } from '$lib/railway/decorations';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate';
	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();

	const TILE = 1;
	const PX_PER_TILE = 56;

	let camera: THREE.PerspectiveCamera | undefined = $state();
	let wrapper: HTMLDivElement | undefined = $state();

	const isDark = $derived(mode.current === 'dark');
	const palette = $derived(
		isDark
			? {
					ground: '#1e293b',
					gridLine: '#334155',
					trackActive: '#e2e8f0',
					trackInactive: '#475569',
					switchMarker: '#22c55e',
					ambient: 0.6,
					directional: 0.7
				}
			: {
					ground: '#f8fafc',
					gridLine: '#cbd5e1',
					trackActive: '#475569',
					trackInactive: '#cbd5e1',
					switchMarker: '#16a34a',
					ambient: 0.55,
					directional: 0.85
				}
	);

	const widthW = $derived(grid.width * TILE);
	const heightW = $derived(grid.height * TILE);
	const widthPx = $derived(grid.width * PX_PER_TILE);
	const heightPx = $derived(grid.height * PX_PER_TILE);

	const cellEntries = $derived(
		[...grid.cells.entries()].map(([k, piece]) => {
			const [x, y] = k.split(',').map(Number);
			return { x, y, piece };
		})
	);

	type VehiclePose = {
		key: string;
		kind: 'loco' | 'wagon';
		color: string;
		occupied: boolean;
		x: number;
		z: number;
		rotY: number;
	};

	function poseOf(v: { x: number; y: number; pathIdx: number; t: number; dir: 1 | -1 }) {
		const piece = getPiece(v.x, v.y);
		if (!piece) return null;
		const path = pathsOf(piece)[v.pathIdx];
		if (!path) return null;
		const s = sample(path, v.t);
		const heading2D = s.heading + (v.dir === -1 ? Math.PI : 0);
		return {
			x: (v.x + s.x) * TILE,
			z: (v.y + s.y) * TILE,
			rotY: -heading2D
		};
	}

	const vehiclePoses = $derived.by(() => {
		const out: VehiclePose[] = [];
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

	$effect(() => {
		if (!camera) return;
		const cx = widthW / 2;
		const cz = heightW / 2;
		const dist = Math.max(widthW, heightW);
		camera.position.set(cx, dist * 0.95, cz + dist * 0.85);
		camera.lookAt(cx, 0, cz);
		camera.updateProjectionMatrix();
	});

	function buildTubeGeom(path: TilePath, tileX: number, tileY: number): THREE.TubeGeometry {
		const segments = isStraight(path) ? 1 : 16;
		const pts: THREE.Vector3[] = [];
		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			const s = sample(path, t);
			pts.push(new THREE.Vector3((tileX + s.x) * TILE, 0.05, (tileY + s.y) * TILE));
		}
		const curve = new THREE.CatmullRomCurve3(pts);
		return new THREE.TubeGeometry(curve, Math.max(segments, 8) * 2, 0.06, 6, false);
	}

	const gridLineGeom = $derived.by(() => {
		const pts: THREE.Vector3[] = [];
		const eps = 0.005;
		for (let i = 0; i <= grid.width; i++) {
			pts.push(new THREE.Vector3(i, eps, 0), new THREE.Vector3(i, eps, grid.height));
		}
		for (let j = 0; j <= grid.height; j++) {
			pts.push(new THREE.Vector3(0, eps, j), new THREE.Vector3(grid.width, eps, j));
		}
		return new THREE.BufferGeometry().setFromPoints(pts);
	});

	function pickGroundCell(ev: MouseEvent): { x: number; y: number } | null {
		if (!camera || !wrapper) return null;
		const rect = wrapper.getBoundingClientRect();
		const ndc = new THREE.Vector2(
			((ev.clientX - rect.left) / rect.width) * 2 - 1,
			-((ev.clientY - rect.top) / rect.height) * 2 + 1
		);
		const ray = new THREE.Raycaster();
		ray.setFromCamera(ndc, camera);
		const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
		const point = new THREE.Vector3();
		if (!ray.ray.intersectPlane(plane, point)) return null;
		const x = Math.floor(point.x / TILE);
		const y = Math.floor(point.z / TILE);
		if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return null;
		return { x, y };
	}

	function handleClick(ev: MouseEvent) {
		const cell = pickGroundCell(ev);
		if (!cell) return;
		const { x, y } = cell;
		const existing = getPiece(x, y);
		if (ev.shiftKey) {
			if (existing && isSwitch(existing.kind)) toggleAt(x, y);
			return;
		}
		if (tool === 'draw') return; // draw tool only works in 2D for now
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
		if (existing && existing.kind === tool) {
			rotateAt(x, y);
		} else {
			placePiece(x, y, tool);
		}
	}

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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={wrapper}
	onclick={handleClick}
	role="img"
	aria-label="Track grid (3D)"
	class="block bg-board-bg select-none"
	style="width: {widthPx}px; height: {heightPx}px;"
>
	<Canvas>
		<T.PerspectiveCamera bind:ref={camera} makeDefault fov={40} near={0.1} far={500} />

		<T.AmbientLight intensity={palette.ambient} />
		<T.DirectionalLight
			position={[widthW, heightW * 1.5, heightW]}
			intensity={palette.directional}
		/>

		<!-- Ground -->
		<T.Mesh position={[widthW / 2, 0, heightW / 2]} rotation={[-Math.PI / 2, 0, 0]}>
			<T.PlaneGeometry args={[widthW, heightW]} />
			<T.MeshStandardMaterial color={palette.ground} />
		</T.Mesh>

		<!-- Grid lines -->
		<T.LineSegments geometry={gridLineGeom}>
			<T.LineBasicMaterial color={palette.gridLine} />
		</T.LineSegments>

		<!-- Groundovers (rendered under track) -->
		{#each groundOverEntries as { x, y, groundOver } (`ground-${cellKey(x, y)}`)}
			<T.Mesh position={[x + 0.5, 0.012, y + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.PlaneGeometry args={[1, 1]} />
				<T.MeshStandardMaterial color={groundOver.kind === 'grass' ? '#86efac' : '#d4d4d8'} />
			</T.Mesh>
			{#if groundOver.kind === 'stone'}
				{#each stoneSpots(x, y) as spot, i (i)}
					<T.Mesh position={[x + spot.cx, 0.025, y + spot.cy]}>
						<T.SphereGeometry args={[spot.r * 0.7, 6, 4]} />
						<T.MeshStandardMaterial color={spot.tone > 0.55 ? '#71717a' : '#a1a1aa'} />
					</T.Mesh>
				{/each}
			{/if}
		{/each}

		<!-- Decorations -->
		{#each decorationEntries as { x, y, decoration } (`deco-${cellKey(x, y)}`)}
			{#if decoration.kind === 'water'}
				<T.Mesh position={[x + 0.5, 0.022, y + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
					<T.PlaneGeometry args={[1, 1]} />
					<T.MeshStandardMaterial color="#3b82f6" />
				</T.Mesh>
			{:else if decoration.kind === 'tree'}
				{#each treeSpots(x, y) as t, i (i)}
					{@const trunkH = 0.08}
					{@const coneR = t.r * 0.6}
					{@const coneH = t.r * 1.6}
					<T.Mesh position={[x + t.cx, trunkH / 2, y + t.cy]}>
						<T.CylinderGeometry args={[0.025, 0.03, trunkH, 6]} />
						<T.MeshStandardMaterial color="#78350f" />
					</T.Mesh>
					<T.Mesh position={[x + t.cx, trunkH + coneH / 2, y + t.cy]}>
						<T.ConeGeometry args={[coneR, coneH, 8]} />
						<T.MeshStandardMaterial color={t.tone > 0.5 ? '#15803d' : '#16a34a'} />
					</T.Mesh>
				{/each}
			{:else if decoration.kind === 'building'}
				<T.Group position={[x + 0.5, 0, y + 0.5]}>
					<T.Mesh position={[0, 0.25, 0]}>
						<T.BoxGeometry args={[0.7, 0.5, 0.7]} />
						<T.MeshStandardMaterial color="#9ca3af" />
					</T.Mesh>
					<T.Mesh position={[0, 0.6, 0]} rotation={[0, Math.PI / 4, 0]}>
						<T.ConeGeometry args={[0.55, 0.25, 4]} />
						<T.MeshStandardMaterial color="#6b7280" />
					</T.Mesh>
				</T.Group>
			{/if}
		{/each}

		<!-- Tracks -->
		{#each cellEntries as { x, y, piece } (cellKey(x, y))}
			{@const switchTile = isSwitch(piece.kind)}
			{@const activeIdx = piece.active ?? 0}
			{#each pathsOf(piece) as path, i (i)}
				{@const inactive = switchTile && i !== activeIdx}
				<T.Mesh geometry={buildTubeGeom(path, x, y)}>
					<T.MeshStandardMaterial
						color={inactive ? palette.trackInactive : palette.trackActive}
						opacity={inactive ? 0.7 : 1}
						transparent={inactive}
					/>
				</T.Mesh>
			{/each}
			{#if switchTile}
				<T.Mesh position={[x + 0.5, 0.12, y + 0.5]}>
					<T.SphereGeometry args={[0.07, 12, 12]} />
					<T.MeshStandardMaterial color={palette.switchMarker} />
				</T.Mesh>
			{/if}
		{/each}

		<!-- Stations -->
		{#each stationEntries as { x, y, station } (`station-${cellKey(x, y)}`)}
			{@const hasPeople = station.peopleWaiting > 0}
			<T.Group position={[x + 0.5, 0.05, y + 0.5]}>
				<T.Mesh position={[0, 0.04, -0.4]}>
					<T.BoxGeometry args={[0.9, 0.08, 0.18]} />
					<T.MeshStandardMaterial color={hasPeople ? '#f59e0b' : '#94a3b8'} />
				</T.Mesh>
				{#each [...Array(Math.min(station.peopleWaiting, 10)).keys()] as i (i)}
					<T.Mesh position={[-0.36 + i * 0.08, 0.16, -0.4]}>
						<T.BoxGeometry args={[0.06, 0.16, 0.06]} />
						<T.MeshStandardMaterial color="#fef3c7" />
					</T.Mesh>
				{/each}
			</T.Group>
		{/each}

		<!-- Vehicles -->
		{#each vehiclePoses as pose (pose.key)}
			<T.Group position={[pose.x, 0.18, pose.z]} rotation={[0, pose.rotY, 0]}>
				{#if pose.kind === 'loco'}
					<T.Mesh>
						<T.BoxGeometry args={[0.6, 0.25, 0.3]} />
						<T.MeshStandardMaterial color={pose.color} />
					</T.Mesh>
					<T.Mesh position={[0.18, 0.05, 0]}>
						<T.BoxGeometry args={[0.15, 0.15, 0.2]} />
						<T.MeshStandardMaterial color="#fbbf24" />
					</T.Mesh>
				{:else}
					<T.Mesh>
						<T.BoxGeometry args={[0.5, 0.22, 0.28]} />
						<T.MeshStandardMaterial color={pose.color} />
					</T.Mesh>
					{#if pose.occupied}
						<T.Mesh position={[0, 0.16, 0]}>
							<T.BoxGeometry args={[0.12, 0.12, 0.12]} />
							<T.MeshStandardMaterial color="#fef3c7" />
						</T.Mesh>
					{/if}
				{/if}
			</T.Group>
		{/each}
	</Canvas>
</div>
