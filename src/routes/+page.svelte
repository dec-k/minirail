<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import Board3D from '$lib/components/Board3D.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import SavesPanel from '$lib/components/SavesPanel.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import LandingScreen from '$lib/components/LandingScreen.svelte';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import type { PieceKind } from '$lib/railway/types';

	let tool: PieceKind | 'loco' | 'erase' | 'draw' | 'station' = $state('draw');
	let view: '2d' | '3d' = $state('2d');
	let started = $state(false);
</script>

{#if !started}
	<LandingScreen onstart={() => (started = true)} />
{:else}
	<div
		class="min-h-screen bg-linear-to-b from-background via-background to-muted/40 px-6 py-8 text-foreground"
	>
		<div class="mx-auto flex max-w-fit flex-col gap-5">
			<header class="flex items-center justify-between gap-6">
				<h1
					class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-3xl tracking-tight text-transparent"
				>
					Minirail
				</h1>

				<div class="flex items-center gap-2">
					<SavesPanel />
					<ToggleGroup.Root
						type="single"
						value={view}
						onValueChange={(v) => v && (view = v as '2d' | '3d')}
						aria-label="View mode"
					>
						<ToggleGroup.Item value="2d" aria-label="2D view">2D</ToggleGroup.Item>
						<ToggleGroup.Item value="3d" aria-label="3D view">3D</ToggleGroup.Item>
					</ToggleGroup.Root>
					<ThemeToggle />
				</div>
			</header>

			<Toolbar bind:tool />

			<div class="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
				{#if view === '2d'}
					<Board {tool} />
				{:else}
					<Board3D {tool} />
				{/if}
			</div>
		</div>
	</div>
{/if}
