<script lang="ts">
	import { T } from '@threlte/core';
	import { buildingSpots, treeSpots } from '$lib/railway/decorations';
	import type { DecorationKind } from '$lib/railway/types';

	let { x, y, kind }: { x: number; y: number; kind: DecorationKind } = $props();

	// Reuse the same deterministic hash-jittered spot layouts as the SVG board so
	// a tile looks identical in both renderers, just extruded into 3D.
</script>

<T.Group position={[x, 0, y]}>
	{#if kind === 'tree'}
		{#each treeSpots(x, y) as t, i (i)}
			{@const rad = t.r}
			{@const trunkH = rad * 0.6}
			{@const c1H = rad * 1.5}
			{@const c2H = rad * 1.1}
			{@const green = t.tone > 0.5 ? '#5b9d47' : '#67a652'}
			{@const greenDark = t.tone > 0.5 ? '#3f6e2e' : '#467a35'}
			<T.Group position={[t.cx, 0, t.cy]}>
				<T.Mesh position={[0, trunkH / 2, 0]} castShadow>
					<T.CylinderGeometry args={[rad * 0.12, rad * 0.16, trunkH, 6]} />
					<T.MeshStandardMaterial color="#6b3a12" roughness={1} />
				</T.Mesh>
				<T.Mesh position={[0, trunkH + c1H / 2, 0]} castShadow>
					<T.ConeGeometry args={[rad * 0.95, c1H, 8]} />
					<T.MeshStandardMaterial color={greenDark} roughness={0.9} />
				</T.Mesh>
				<T.Mesh position={[0, trunkH + c1H * 0.72 + c2H / 2, 0]} castShadow>
					<T.ConeGeometry args={[rad * 0.7, c2H, 8]} />
					<T.MeshStandardMaterial color={green} roughness={0.9} />
				</T.Mesh>
			</T.Group>
		{/each}
	{:else if kind === 'building'}
		{#each buildingSpots(x, y) as b, i (i)}
			{@const w = b.size}
			{@const bodyH = b.size * 1.15}
			{@const roofH = b.size * 0.7}
			{@const body = b.tone > 0.5 ? '#f0dfc2' : '#e0cfae'}
			{@const roof = b.roofTone < 0.34 ? '#a04d3a' : b.roofTone < 0.67 ? '#7a5535' : '#5a6072'}
			<T.Group position={[b.cx, 0, b.cy]}>
				<T.Mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
					<T.BoxGeometry args={[w, bodyH, w]} />
					<T.MeshStandardMaterial color={body} roughness={0.85} />
				</T.Mesh>
				<!-- 4-sided cone = pyramid roof, turned 45° to sit square on the box -->
				<T.Mesh position={[0, bodyH + roofH / 2, 0]} rotation.y={Math.PI / 4} castShadow>
					<T.ConeGeometry args={[w * 0.74, roofH, 4]} />
					<T.MeshStandardMaterial color={roof} roughness={0.8} />
				</T.Mesh>
			</T.Group>
		{/each}
	{:else if kind === 'water'}
		<T.Mesh rotation.x={-Math.PI / 2} position={[0.5, 0.04, 0.5]} receiveShadow>
			<T.PlaneGeometry args={[1, 1]} />
			<T.MeshStandardMaterial
				color="#3a8fc7"
				transparent
				opacity={0.88}
				roughness={0.2}
				metalness={0.15}
			/>
		</T.Mesh>
	{/if}
</T.Group>
