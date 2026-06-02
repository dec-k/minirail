<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './board3d/Scene.svelte';
	import type { DecorationKind, PieceKind } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan';

	let { tool, decorationKind }: { tool: Tool; decorationKind: DecorationKind } = $props();
</script>

<div class="absolute inset-0 overflow-hidden bg-board-bg">
	<Canvas>
		<Scene {tool} {decorationKind} />
	</Canvas>
</div>
