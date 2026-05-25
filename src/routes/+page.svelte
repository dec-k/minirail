<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import LocoPanel from '$lib/components/LocoPanel.svelte';
	import SavesPanel from '$lib/components/SavesPanel.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import LandingScreen from '$lib/components/LandingScreen.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { clearAll } from '$lib/railway/grid.svelte';
	import { clearAllLocos } from '$lib/railway/sim.svelte';
	import { Trash2 } from 'lucide-svelte';
	import type { DecorationKind, PieceKind } from '$lib/railway/types';

	let tool: PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' = $state('draw');
	let decorationKind: DecorationKind = $state('tree');
	let started = $state(false);

	function clearBoard() {
		clearAllLocos();
		clearAll();
	}
</script>

{#if !started}
	<LandingScreen onstart={() => (started = true)} />
{:else}
	<div class="fixed inset-0 overflow-hidden bg-board-bg text-foreground">
		<Board {tool} {decorationKind} />

		<div class="pointer-events-none absolute top-4 left-4">
			<h1
				class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-2xl tracking-tight text-transparent drop-shadow-sm"
			>
				Minirail
			</h1>
		</div>

		<div
			class="pointer-events-auto absolute top-4 right-4 flex items-center gap-1 rounded-xl border border-border bg-card/90 px-2 py-1.5 shadow-md backdrop-blur"
		>
			<SavesPanel />
			<Separator orientation="vertical" class="h-5!" />
			<Button
				variant="ghost"
				size="sm"
				onclick={clearBoard}
				title="Clear board"
				class="text-muted-foreground hover:text-destructive"
			>
				<Trash2 />
				Clear
			</Button>
			<Separator orientation="vertical" class="h-5!" />
			<ThemeToggle />
		</div>

		<div class="pointer-events-auto absolute top-1/2 left-4 -translate-y-1/2">
			<ToolPalette bind:tool bind:decorationKind />
		</div>

		<div
			class="pointer-events-auto absolute bottom-4 left-1/2 max-w-[min(96vw,72rem)] -translate-x-1/2"
		>
			<LocoPanel />
		</div>
	</div>
{/if}
