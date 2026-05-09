<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import type { PieceKind } from '$lib/railway/types';

	let tool: PieceKind | 'loco' | 'erase' = $state('straight');
</script>

<div class="min-h-screen bg-slate-100 p-6">
	<div class="mx-auto flex max-w-fit flex-col gap-3">
		<h1 class="text-xl font-semibold text-slate-900">Mini Rail</h1>
		<p class="text-sm text-slate-600">
			Click cells to place track. Click a piece of the same kind again to rotate it.
			<span class="font-medium">Shift+click</span> a switch to throw it. Place a locomotive on any
			track tile, then press Play.
		</p>
		<Toolbar bind:tool />
		<Board {tool} />
	</div>
</div>
