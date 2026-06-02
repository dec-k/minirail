<script lang="ts">
	import { T } from '@threlte/core';

	let {
		kind,
		color,
		occupied,
		x,
		z,
		rotY
	}: {
		kind: 'loco' | 'wagon';
		color: string;
		occupied: boolean;
		x: number;
		z: number;
		rotY: number;
	} = $props();

	// Match the SVG vehicle's trim shade.
	function darken(hex: string): string {
		const m = /^#([0-9a-f]{6})$/i.exec(hex);
		if (!m) return hex;
		const n = parseInt(m[1], 16);
		const r = Math.max(0, ((n >> 16) & 0xff) - 60);
		const g = Math.max(0, ((n >> 8) & 0xff) - 60);
		const b = Math.max(0, (n & 0xff) - 60);
		return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
	}

	const dark = $derived(darken(color));
	// Bodies are modelled along +X; the group's rotation.y turns +X into the
	// direction of travel (set by the caller from the path heading).
</script>

<T.Group position={[x, 0, z]} rotation.y={rotY}>
	{#if kind === 'loco'}
		<!-- chassis -->
		<T.Mesh position={[0, 0.11, 0]} castShadow>
			<T.BoxGeometry args={[0.62, 0.08, 0.3]} />
			<T.MeshStandardMaterial color={dark} roughness={0.6} metalness={0.3} />
		</T.Mesh>
		<!-- boiler / body -->
		<T.Mesh position={[0.05, 0.22, 0]} castShadow>
			<T.BoxGeometry args={[0.5, 0.2, 0.26]} />
			<T.MeshStandardMaterial {color} roughness={0.5} metalness={0.2} />
		</T.Mesh>
		<!-- cab at the rear -->
		<T.Mesh position={[-0.21, 0.3, 0]} castShadow>
			<T.BoxGeometry args={[0.18, 0.22, 0.28]} />
			<T.MeshStandardMaterial color={dark} roughness={0.55} metalness={0.25} />
		</T.Mesh>
		<!-- chimney near the front -->
		<T.Mesh position={[0.2, 0.36, 0]} castShadow>
			<T.CylinderGeometry args={[0.045, 0.055, 0.12, 10]} />
			<T.MeshStandardMaterial color="#222" roughness={0.8} />
		</T.Mesh>
		<!-- front lamp -->
		<T.Mesh position={[0.3, 0.22, 0]} castShadow>
			<T.SphereGeometry args={[0.04, 10, 10]} />
			<T.MeshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.5} />
		</T.Mesh>
	{:else}
		<T.Mesh position={[0, 0.18, 0]} castShadow>
			<T.BoxGeometry args={[0.5, 0.18, 0.26]} />
			<T.MeshStandardMaterial {color} roughness={0.5} metalness={0.2} />
		</T.Mesh>
		{#if occupied}
			<T.Mesh position={[0, 0.31, 0]} castShadow>
				<T.SphereGeometry args={[0.04, 10, 10]} />
				<T.MeshStandardMaterial color="#fbe49d" roughness={0.8} />
			</T.Mesh>
		{/if}
	{/if}
</T.Group>
