<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import Board3D from '$lib/components/Board3D.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import type { PieceKind } from '$lib/railway/types';

	let tool: PieceKind | 'loco' | 'erase' | 'draw' = $state('draw');
	let view: '2d' | '3d' = $state('2d');
</script>

<div class="min-h-screen bg-slate-100 p-6">
	<div class="mx-auto flex max-w-fit flex-col gap-3">
		<div class="flex items-center justify-between gap-4">
			<h1 class="text-xl font-semibold text-slate-900">Mini Rail</h1>
			<div class="flex gap-1 rounded-md border border-slate-300 bg-white p-1 text-sm">
				<button
					class="rounded px-3 py-1 {view === '2d'
						? 'bg-slate-800 text-white'
						: 'text-slate-700 hover:bg-slate-100'}"
					onclick={() => (view = '2d')}
				>
					2D
				</button>
				<button
					class="rounded px-3 py-1 {view === '3d'
						? 'bg-slate-800 text-white'
						: 'text-slate-700 hover:bg-slate-100'}"
					onclick={() => (view = '3d')}
				>
					3D
				</button>
			</div>
		</div>
		<p class="text-sm text-slate-600">
			Use <span class="font-medium">Draw</span> to drag a continuous path — pieces are chosen
			automatically; dragging through an existing track creates a switch. Or pick a specific piece
			and click cells; click a piece of the same kind again to rotate it.
			<span class="font-medium">Shift+click</span> a switch to throw it.
		</p>
		<Toolbar bind:tool />
		{#if view === '2d'}
			<Board {tool} />
		{:else}
			<Board3D {tool} />
		{/if}
	</div>
</div>
