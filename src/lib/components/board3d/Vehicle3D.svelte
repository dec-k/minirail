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

	// Wheel rows: a wheel is a thin cylinder with its axle along Z (rotation.x),
	// so it reads as a disc seen from the side. One small array per vehicle keeps
	// the mesh count down while still suggesting a wheelbase.
	const HALF_GAUGE = 0.17;
	const locoWheelX = [-0.16, 0.04, 0.22];
	const wagonWheelX = [-0.18, 0.18];

	// Bodies are modelled along +X; the group's rotation.y turns +X into the
	// direction of travel (set by the caller from the path heading).
</script>

<T.Group position={[x, 0, z]} rotation.y={rotY}>
	{#if kind === 'loco'}
		<!-- footplate / chassis -->
		<T.Mesh position={[0, 0.08, 0]} castShadow>
			<T.BoxGeometry args={[0.64, 0.05, 0.34]} />
			<T.MeshStandardMaterial color={dark} roughness={0.6} metalness={0.3} />
		</T.Mesh>

		<!-- cylindrical boiler (rotated to lie along the travel axis) -->
		<T.Mesh position={[0.08, 0.24, 0]} rotation.z={Math.PI / 2} castShadow>
			<T.CylinderGeometry args={[0.13, 0.13, 0.42, 14]} />
			<T.MeshStandardMaterial {color} roughness={0.45} metalness={0.25} />
		</T.Mesh>
		<!-- smokebox front cap -->
		<T.Mesh position={[0.3, 0.24, 0]} rotation.z={Math.PI / 2} castShadow>
			<T.CylinderGeometry args={[0.135, 0.135, 0.04, 14]} />
			<T.MeshStandardMaterial color={dark} roughness={0.6} metalness={0.3} />
		</T.Mesh>

		<!-- brass steam dome on the boiler -->
		<T.Mesh position={[0, 0.4, 0]} castShadow>
			<T.SphereGeometry args={[0.07, 12, 12]} />
			<T.MeshStandardMaterial color="#c9a23a" roughness={0.4} metalness={0.5} />
		</T.Mesh>

		<!-- flared funnel chimney -->
		<T.Mesh position={[0.22, 0.45, 0]} castShadow>
			<T.CylinderGeometry args={[0.065, 0.04, 0.16, 12]} />
			<T.MeshStandardMaterial color="#1f1f1f" roughness={0.8} />
		</T.Mesh>

		<!-- cab at the rear -->
		<T.Mesh position={[-0.23, 0.3, 0]} castShadow>
			<T.BoxGeometry args={[0.2, 0.26, 0.32]} />
			<T.MeshStandardMaterial {color} roughness={0.5} metalness={0.2} />
		</T.Mesh>
		<!-- cab roof, slightly overhanging -->
		<T.Mesh position={[-0.23, 0.45, 0]} castShadow>
			<T.BoxGeometry args={[0.24, 0.04, 0.36]} />
			<T.MeshStandardMaterial color={dark} roughness={0.55} metalness={0.25} />
		</T.Mesh>

		<!-- front lamp -->
		<T.Mesh position={[0.34, 0.26, 0]} castShadow>
			<T.SphereGeometry args={[0.04, 10, 10]} />
			<T.MeshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.5} />
		</T.Mesh>

		<!-- driving wheels -->
		{#each locoWheelX as wx (wx)}
			{#each [HALF_GAUGE, -HALF_GAUGE] as wz (wz)}
				<T.Mesh position={[wx, 0.07, wz]} rotation.x={Math.PI / 2} castShadow>
					<T.CylinderGeometry args={[0.075, 0.075, 0.04, 12]} />
					<T.MeshStandardMaterial color="#15171a" roughness={0.6} metalness={0.4} />
				</T.Mesh>
			{/each}
		{/each}
	{:else}
		<!-- carriage body -->
		<T.Mesh position={[0, 0.2, 0]} castShadow>
			<T.BoxGeometry args={[0.58, 0.2, 0.28]} />
			<T.MeshStandardMaterial {color} roughness={0.5} metalness={0.2} />
		</T.Mesh>
		<!-- window band — glows warm when the carriage carries passengers -->
		<T.Mesh position={[0, 0.25, 0]} castShadow>
			<T.BoxGeometry args={[0.48, 0.07, 0.29]} />
			<T.MeshStandardMaterial
				color={occupied ? '#ffe2a6' : '#cfe6f2'}
				emissive={occupied ? '#ffcf7a' : '#000000'}
				emissiveIntensity={occupied ? 0.6 : 0}
				roughness={0.3}
				metalness={0.1}
			/>
		</T.Mesh>
		<!-- rounded clerestory roof (half-cylinder along the carriage) -->
		<T.Mesh position={[0, 0.3, 0]} rotation.z={Math.PI / 2} castShadow>
			<T.CylinderGeometry args={[0.15, 0.15, 0.58, 14]} />
			<T.MeshStandardMaterial color={dark} roughness={0.55} metalness={0.2} />
		</T.Mesh>

		<!-- wheels -->
		{#each wagonWheelX as wx (wx)}
			{#each [HALF_GAUGE, -HALF_GAUGE] as wz (wz)}
				<T.Mesh position={[wx, 0.07, wz]} rotation.x={Math.PI / 2} castShadow>
					<T.CylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
					<T.MeshStandardMaterial color="#15171a" roughness={0.6} metalness={0.4} />
				</T.Mesh>
			{/each}
		{/each}
	{/if}
</T.Group>
