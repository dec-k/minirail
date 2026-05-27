<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import LocoPanel from '$lib/components/LocoPanel.svelte';
	import SavesPanel from '$lib/components/SavesPanel.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import LandingScreen from '$lib/components/LandingScreen.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Popover from '$lib/components/ui/popover';
	import { clearAll } from '$lib/railway/grid.svelte';
	import { clearAllLocos } from '$lib/railway/sim.svelte';
	import { Menu, Trash2 } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { DecorationKind, PieceKind } from '$lib/railway/types';

	let tool: PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate' | 'pan' = $state('draw');
	let decorationKind: DecorationKind = $state('tree');
	let started = $state(false);
	let menuOpen = $state(false);

	function clearBoard() {
		clearAllLocos();
		clearAll();
		menuOpen = false;
	}
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
			class="pointer-events-none absolute top-4 left-4"
			in:fly={{ y: -12, duration: 450, delay: 350, easing: cubicOut }}
		>
			<h1
				class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-2xl tracking-tight text-transparent drop-shadow-sm"
			>
				Minirail
			</h1>
		</div>

		<div
			class="pointer-events-auto absolute top-4 right-4"
			in:fly={{ y: -12, duration: 450, delay: 400, easing: cubicOut }}
		>
			<Popover.Root bind:open={menuOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button
							variant="outline"
							size="sm"
							{...props}
							class="rounded-xl border-border bg-card/90 shadow-md backdrop-blur"
						>
							<Menu />
							Menu
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-48 p-1.5">
					<div class="flex flex-col gap-1">
						<SavesPanel />
						<Separator />
						<Button
							variant="ghost"
							size="sm"
							onclick={clearBoard}
							class="w-full justify-start text-muted-foreground hover:text-destructive"
						>
							<Trash2 />
							Clear board
						</Button>
						<Separator />
						<ThemeToggle />
					</div>
				</Popover.Content>
			</Popover.Root>
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
