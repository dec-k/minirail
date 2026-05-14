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
		cycleStationColorAt
	} from '$lib/railway/grid.svelte';
	import { sim, placeLoco, kickSimulation } from '$lib/railway/sim.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import { sample, isStraight } from '$lib/railway/geometry';
	import {
		isSwitch,
		cellKey,
		STATION_PALETTE,
		type PieceKind,
		type TilePath
	} from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station';
	let { tool }: { tool: Tool } = $props();

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
		// Origin-station fill colour of the passenger this wagon is carrying.
		passengerFill: string | null;
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
				out.push({
					key: `loco-${l.id}`,
					kind: 'loco',
					color: l.color,
					occupied: false,
					passengerFill: null,
					...lp
				});
			for (let i = 0; i < l.wagons.length; i++) {
				const wp = poseOf(l.wagons[i]);
				if (!wp) continue;
				const occupied = i < l.passengers.length;
				let passengerFill: string | null = null;
				if (occupied) {
					const originColor = grid.stations.get(l.passengers[i])?.color ?? 'gray';
					passengerFill = STATION_PALETTE[originColor].fill;
				}
				out.push({
					key: `wagon-${l.id}-${i}`,
					kind: 'wagon',
					color: l.color,
					occupied,
					passengerFill,
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
			// Station colour cycle takes priority over switch toggle when both
			// coexist on the same tile.
			if (grid.stations.has(cellKey(x, y))) {
				cycleStationColorAt(x, y);
				return;
			}
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
			{@const swatch = STATION_PALETTE[station.color]}
			<T.Group position={[x + 0.5, 0.05, y + 0.5]}>
				<T.Mesh position={[0, 0.04, -0.4]}>
					<T.BoxGeometry args={[0.9, 0.08, 0.18]} />
					<T.MeshStandardMaterial
						color={swatch.fill}
						opacity={hasPeople ? 1 : 0.7}
						transparent={!hasPeople}
					/>
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
					{#if pose.occupied && pose.passengerFill}
						<T.Mesh position={[0, 0.16, 0]}>
							<T.BoxGeometry args={[0.12, 0.12, 0.12]} />
							<T.MeshStandardMaterial color={pose.passengerFill} />
						</T.Mesh>
					{/if}
				{/if}
			</T.Group>
		{/each}
	</Canvas>
</div>
