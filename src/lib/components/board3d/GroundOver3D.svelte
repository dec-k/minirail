<script lang="ts">
	import { T } from '@threlte/core';
	import { grassTufts, stoneSpots } from '$lib/railway/decorations';
	import type { DecorationKind } from '$lib/railway/types';

	let { x, y, kind }: { x: number; y: number; kind: DecorationKind } = $props();

	// Groundcover sits just above the base ground (and above the grid lines, so it
	// masks them on its tile) but below rail height, matching the SVG's "under
	// track" layering.
	const PATCH_Y = 0.014;
</script>

<T.Group position={[x, 0, y]}>
	{#if kind === 'grass'}
		<T.Mesh rotation.x={-Math.PI / 2} position={[0.5, PATCH_Y, 0.5]} receiveShadow>
			<T.PlaneGeometry args={[1, 1]} />
			<T.MeshStandardMaterial color="#7faf5a" roughness={1} />
		</T.Mesh>
		{#each grassTufts(x, y) as g, i (i)}
			<T.Mesh position={[g.cx, 0.045, g.cy]} castShadow>
				<T.ConeGeometry args={[0.035, 0.09, 4]} />
				<T.MeshStandardMaterial color={g.tone > 0.5 ? '#5f8f3a' : '#6fa548'} roughness={1} />
			</T.Mesh>
		{/each}
	{:else if kind === 'stone'}
		<T.Mesh rotation.x={-Math.PI / 2} position={[0.5, PATCH_Y, 0.5]} receiveShadow>
			<T.PlaneGeometry args={[1, 1]} />
			<T.MeshStandardMaterial color="#b8b2a6" roughness={1} />
		</T.Mesh>
		{#each stoneSpots(x, y) as s, i (i)}
			<T.Mesh position={[s.cx, s.r * 0.45, s.cy]} rotation.y={s.tone * 6} castShadow>
				<T.DodecahedronGeometry args={[s.r]} />
				<T.MeshStandardMaterial color={s.tone > 0.5 ? '#9a948a' : '#aaa499'} roughness={1} />
			</T.Mesh>
		{/each}
	{/if}
</T.Group>
