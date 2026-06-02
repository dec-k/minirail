<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import Board3D from '$lib/components/Board3D.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import LocoPanel from '$lib/components/LocoPanel.svelte';
	import MainMenu from '$lib/components/MainMenu.svelte';
	import LandingScreen from '$lib/components/LandingScreen.svelte';
	import { doc } from '$lib/railway/doc.svelte';
	import { view, toggleTilt } from '$lib/railway/view.svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Box, Square } from 'lucide-svelte';
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
		{#if view.tilted}
			<Board3D {tool} {decorationKind} />
		{:else}
			<Board {tool} {decorationKind} />
		{/if}

		<div
			class="pointer-events-none absolute top-4 left-4"
			in:fly={{ y: -12, duration: 450, delay: 350, easing: cubicOut }}
		>
			<h1
				class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-2xl tracking-tight text-transparent"
			>
				Minirail
			</h1>
		</div>

		<div
			class="save-name pointer-events-none absolute top-4 left-1/2 flex max-w-[60vw] -translate-x-1/2 items-baseline gap-1.5 text-sm font-semibold text-foreground"
			in:fly={{ y: -12, duration: 450, delay: 350, easing: cubicOut }}
		>
			<span class="truncate">
				{doc.name ?? 'Untitled track'}
			</span>
			{#if doc.dirty}
				<span
					class="text-xs font-medium text-amber-600 dark:text-amber-400"
					title="Unsaved changes"
					aria-label="Unsaved changes">•</span
				>
			{/if}
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

		<div
			class="pointer-events-auto absolute right-4 bottom-4"
			in:fly={{ y: 16, duration: 500, delay: 550, easing: cubicOut }}
		>
			<button
				type="button"
				onclick={toggleTilt}
				aria-pressed={view.tilted}
				title={view.tilted ? 'Flat 2D view' : '3D diorama view'}
				class="flex size-11 items-center justify-center rounded-lg border bg-card text-card-foreground shadow-2xl ring-1 ring-black/5 transition-colors hover:bg-accent hover:text-accent-foreground dark:ring-white/10"
				class:bg-primary={view.tilted}
				class:text-primary-foreground={view.tilted}
			>
				{#if view.tilted}
					<Square class="size-5" />
				{:else}
					<Box class="size-5" />
				{/if}
			</button>
		</div>
	</div>
{/if}

<style>
	.save-name {
		text-shadow:
			0 0 6px var(--color-board-bg),
			0 0 6px var(--color-board-bg),
			0 0 3px var(--color-board-bg),
			0 0 3px var(--color-board-bg);
	}
</style>
