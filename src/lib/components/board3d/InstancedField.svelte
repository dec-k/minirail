<script lang="ts">
	import { T } from '@threlte/core';
	import * as THREE from 'three';
	import type { InstanceItem } from './instances';

	let {
		geometry,
		material,
		items,
		castShadow = false,
		receiveShadow = false
	}: {
		geometry: THREE.BufferGeometry;
		material: THREE.Material;
		items: InstanceItem[];
		castShadow?: boolean;
		receiveShadow?: boolean;
	} = $props();

	let mesh = $state<THREE.InstancedMesh>();
	const dummy = new THREE.Object3D();
	const tmp = new THREE.Color();

	// Writes per-instance transforms (and optional colours) whenever the item list
	// changes — i.e. on edits, not every frame, so the cost is amortised. The
	// InstancedMesh is recreated via {#key} when the count changes so the buffer
	// is sized correctly.
	$effect(() => {
		const m = mesh;
		if (!m) return;
		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			dummy.position.set(it.x, it.y, it.z);
			dummy.rotation.set(0, it.ry ?? 0, 0);
			dummy.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
			dummy.updateMatrix();
			m.setMatrixAt(i, dummy.matrix);
			if (it.color !== undefined) m.setColorAt(i, tmp.set(it.color));
		}
		m.count = items.length;
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
		m.computeBoundingSphere(); // keep frustum culling correct
	});
</script>

{#key items.length}
	<!-- dispose={false}: geometry/material are shared module-level singletons and
		 must survive this mesh being recreated on count change. -->
	<T.InstancedMesh
		args={[geometry, material, Math.max(items.length, 1)]}
		bind:ref={mesh}
		dispose={false}
		{castShadow}
		{receiveShadow}
	/>
{/key}
