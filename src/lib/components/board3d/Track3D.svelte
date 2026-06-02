<script lang="ts">
	import { T } from '@threlte/core';
	import { pathsOf } from '$lib/railway/pieces';
	import { isSwitch, type Piece } from '$lib/railway/types';
	import { railGeometry, sleepers, RAIL_Y } from './geometry3d';

	let { x, y, piece }: { x: number; y: number; piece: Piece } = $props();

	const switchTile = $derived(isSwitch(piece.kind));
	const activeIdx = $derived(piece.active ?? 0);

	// One render entry per path: its two rail tube geometries, sleeper transforms,
	// and whether it's the dimmed (inactive) branch of a switch. Recomputed when
	// the piece changes (rotate / toggle) — fine at this scale.
	const rails = $derived(
		pathsOf(piece).map((p, i) => ({
			i,
			inactive: switchTile && i !== activeIdx,
			left: railGeometry(p, 1),
			right: railGeometry(p, -1),
			ties: sleepers(p)
		}))
	);
</script>

<T.Group position={[x, 0, y]}>
	{#each rails as r (r.i)}
		{@const railColor = r.inactive ? '#b8b0a0' : '#8a8a92'}
		{@const tieColor = r.inactive ? '#9b8b6e' : '#5a3a1f'}
		<!-- ballast under the rails -->
		{#each r.ties as tie, k (k)}
			<T.Mesh
				position={[tie.x, RAIL_Y * 0.5, tie.z]}
				rotation.y={tie.rotY}
				castShadow
				receiveShadow
			>
				<T.BoxGeometry args={[0.07, 0.06, 0.46]} />
				<T.MeshStandardMaterial color={tieColor} roughness={0.95} />
			</T.Mesh>
		{/each}
		<T.Mesh geometry={r.left} castShadow>
			<T.MeshStandardMaterial color={railColor} metalness={0.6} roughness={0.4} />
		</T.Mesh>
		<T.Mesh geometry={r.right} castShadow>
			<T.MeshStandardMaterial color={railColor} metalness={0.6} roughness={0.4} />
		</T.Mesh>
	{/each}
	{#if switchTile}
		<T.Mesh position={[0.5, RAIL_Y, 0.5]}>
			<T.SphereGeometry args={[0.06, 12, 12]} />
			<T.MeshStandardMaterial color="#3fae6a" emissive="#1f6e3a" emissiveIntensity={0.3} />
		</T.Mesh>
	{/if}
</T.Group>
