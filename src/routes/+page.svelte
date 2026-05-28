<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import LocoPanel from '$lib/components/LocoPanel.svelte';
	import MainMenu from '$lib/components/MainMenu.svelte';
	import LandingScreen from '$lib/components/LandingScreen.svelte';
	import { doc } from '$lib/railway/doc.svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { DecorationKind, PieceKind } from '$lib/railway/types';

	let tool: PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan' = $state('draw');
	let decorationKind: DecorationKind = $state('tree');
	let started = $state(false);
</script>

{#if !started}
	<LandingScreen onstart={() => (started = true)} />
{:else}
	<div
		class="fixed inset-0 overflow-hidden bg-board-bg text-foreground"
		in:fade={{ duration: 500, delay: 150, easing: cubicOut }}
	>
		<Board {tool} {decorationKind} />

		<div
			class="pointer-events-none absolute top-4 left-4 flex items-baseline gap-3 rounded-xl border border-border bg-card/90 px-3 py-1.5 shadow-md backdrop-blur"
			in:fly={{ y: -12, duration: 450, delay: 350, easing: cubicOut }}
		>
			<h1
				class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-2xl tracking-tight text-transparent"
			>
				Minirail
			</h1>
			<span class="flex items-baseline gap-1.5 text-sm text-muted-foreground">
				<span class="max-w-[40vw] truncate">
					{doc.name ?? 'Untitled track'}
				</span>
				{#if doc.dirty}
					<span
						class="text-xs font-medium text-amber-600 dark:text-amber-400"
						title="Unsaved changes"
						aria-label="Unsaved changes">•</span
					>
				{/if}
			</span>
		</div>

		<div
			class="pointer-events-auto absolute top-4 right-4"
			in:fly={{ y: -12, duration: 450, delay: 400, easing: cubicOut }}
		>
			<MainMenu />
		</div>

		<div
			class="pointer-events-auto absolute top-1/2 left-4 -translate-y-1/2"
			in:fly={{ x: -16, duration: 500, delay: 450, easing: cubicOut }}
		>
			<ToolPalette bind:tool bind:decorationKind />
		</div>

		<div
			class="pointer-events-auto absolute bottom-4 left-1/2 max-w-[min(96vw,72rem)] -translate-x-1/2"
			in:fly={{ y: 16, duration: 500, delay: 500, easing: cubicOut }}
		>
			<LocoPanel />
		</div>
	</div>
{/if}
