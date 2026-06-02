<script lang="ts">
	import { Canvas } from '@threlte/core';
	import * as THREE from 'three';
	import Scene from './board3d/Scene.svelte';
	import type { DecorationKind, PieceKind } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan';

	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();
</script>

<div class="absolute inset-0 overflow-hidden bg-board-bg">
	<!-- Soft shadows + filmic tone mapping so the strong key light shapes form
		 without clipping highlights to flat white. -->
	<Canvas shadows={THREE.PCFSoftShadowMap} toneMapping={THREE.ACESFilmicToneMapping}>
		<Scene {tool} {decorationKind} />
	</Canvas>
</div>
