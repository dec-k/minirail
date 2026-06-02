<script lang="ts">
	import { T } from '@threlte/core';
	import { getPiece } from '$lib/railway/grid.svelte';
	import { pathsOf } from '$lib/railway/pieces';
	import type { Station } from '$lib/railway/types';

	let { x, y, station }: { x: number; y: number; station: Station } = $props();

	// Same edge-picking rule as the SVG StationTile: vertical track → platform on
	// the east edge, otherwise the south edge.
	function platformOrientation(): 'south' | 'east' {
		const piece = getPiece(x, y);
		if (!piece) return 'south';
		for (const p of pathsOf(piece)) {
			if (p.from === 1 || p.from === 3 || p.to === 1 || p.to === 3) return 'south';
		}
		return 'east';
	}

	const orient = $derived(platformOrientation());
	const headCount = $derived(Math.min(station.peopleWaiting, 5));
	const PLAT_H = 0.07;

	// People positions along the platform, mirroring the SVG layout.
	const people = $derived(
		Array.from({ length: headCount }, (_, i) =>
			orient === 'south' ? { px: 0.18 + i * 0.16, pz: 0.86 } : { px: 0.85, pz: 0.43 + i * 0.105 }
		)
	);
</script>

<T.Group position={[x, 0, y]}>
	{#if orient === 'south'}
		<T.Mesh position={[0.5, PLAT_H / 2, 0.85]} castShadow receiveShadow>
			<T.BoxGeometry args={[0.9, PLAT_H, 0.2]} />
			<T.MeshStandardMaterial color="#d6c598" roughness={0.9} />
		</T.Mesh>
		<!-- shelter roof on posts -->
		<T.Mesh position={[0.5, 0.28, 0.72]} castShadow>
			<T.BoxGeometry args={[0.4, 0.04, 0.18]} />
			<T.MeshStandardMaterial color="#8a6a48" roughness={0.85} />
		</T.Mesh>
		{#each [0.34, 0.66] as ppx (ppx)}
			<T.Mesh position={[ppx, 0.14, 0.72]} castShadow>
				<T.CylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
				<T.MeshStandardMaterial color="#5a4030" roughness={0.9} />
			</T.Mesh>
		{/each}
	{:else}
		<T.Mesh position={[0.85, PLAT_H / 2, 0.5]} castShadow receiveShadow>
			<T.BoxGeometry args={[0.2, PLAT_H, 0.9]} />
			<T.MeshStandardMaterial color="#d6c598" roughness={0.9} />
		</T.Mesh>
		<T.Mesh position={[0.72, 0.28, 0.5]} castShadow>
			<T.BoxGeometry args={[0.18, 0.04, 0.4]} />
			<T.MeshStandardMaterial color="#8a6a48" roughness={0.85} />
		</T.Mesh>
		{#each [0.34, 0.66] as ppz (ppz)}
			<T.Mesh position={[0.72, 0.14, ppz]} castShadow>
				<T.CylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
				<T.MeshStandardMaterial color="#5a4030" roughness={0.9} />
			</T.Mesh>
		{/each}
	{/if}

	{#each people as person, i (i)}
		<T.Group position={[person.px, PLAT_H, person.pz]}>
			<T.Mesh position={[0, 0.06, 0]} castShadow>
				<T.CylinderGeometry args={[0.035, 0.045, 0.12, 8]} />
				<T.MeshStandardMaterial color="#d98c5f" roughness={0.85} />
			</T.Mesh>
			<T.Mesh position={[0, 0.15, 0]} castShadow>
				<T.SphereGeometry args={[0.035, 10, 10]} />
				<T.MeshStandardMaterial color="#f0c39a" roughness={0.8} />
			</T.Mesh>
		</T.Group>
	{/each}
</T.Group>
