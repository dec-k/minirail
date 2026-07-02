<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Upload, FolderOpen, Trash2, X, Check, TrainTrack, ChevronLeft } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		listLocalSaves,
		loadLocalByKey,
		readLayoutFromFile,
		applyLayout,
		deleteLocalByKey,
		newDocument,
		type SavedEntry,
		type SavedLayout
	} from '$lib/railway/persistence';
	import LandingBackdrop from './LandingBackdrop.svelte';
	import backdropLayout from '$lib/railway/landingLayout.json';

	let { onstart }: { onstart: () => void } = $props();

	// Populate the live world with a decorative sample layout so the backdrop has
	// something to render. Safe to load into the real stores: the landing screen
	// only shows before the canvas starts, and every start action (New / open a
	// save / import) overwrites this first.
	onMount(() => {
		applyLayout(backdropLayout as unknown as SavedLayout, null);
	});

	let entries = $state<SavedEntry[]>([]);
	let fileInput: HTMLInputElement | null = $state(null);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
	let view = $state<'main' | 'load'>('main');

	function refresh() {
		entries = listLocalSaves();
	}

	$effect(() => {
		refresh();
	});

	function flash(kind: 'ok' | 'err', text: string) {
		message = { kind, text };
		setTimeout(() => {
			if (message?.text === text) message = null;
		}, 3000);
	}

	function fmtTime(ms: number): string {
		if (!ms) return '';
		const d = new Date(ms);
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function startNew() {
		newDocument();
		onstart();
	}

	function loadEntry(entry: SavedEntry) {
		try {
			const layout = loadLocalByKey(entry.key);
			if (!layout) {
				flash('err', `"${entry.name}" not found.`);
				refresh();
				return;
			}
			applyLayout(layout, entry.key);
			onstart();
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Load failed.');
		}
	}

	function deleteEntry(key: string) {
		deleteLocalByKey(key);
		refresh();
	}

	async function handleFileChosen(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const layout = await readLayoutFromFile(file);
			applyLayout(layout, null);
			onstart();
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Import failed.');
		}
	}
</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-background via-background to-muted/40 px-6 py-16 text-foreground"
	in:fade={{ duration: 500, easing: cubicOut }}
	out:fade={{ duration: 250, easing: cubicOut }}
>
	<!-- Decorative, zoomed-in, partly-opaque view of a running layout. -->
	<div
		class="pointer-events-none absolute inset-0 opacity-25 blur-[1px]"
		aria-hidden="true"
		in:fade={{ duration: 1400, delay: 150, easing: cubicOut }}
	>
		<LandingBackdrop />
	</div>
	<!-- Scrim to keep the controls legible over the busy scene. -->
	<div
		class="pointer-events-none absolute inset-0 bg-linear-to-b from-background/70 via-background/50 to-background/70"
		aria-hidden="true"
	></div>

	<div class="relative z-10 flex w-full max-w-md flex-col gap-8">
		<header
			class="flex flex-col gap-3 text-center"
			in:fly={{ y: -16, duration: 600, delay: 100, easing: cubicOut }}
		>
			<h1
				class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-6xl tracking-tight text-transparent"
			>
				Minirail
			</h1>
			<p class="text-base text-muted-foreground">a game by dec keighley</p>
		</header>

		<input
			type="file"
			accept=".json,application/json"
			class="hidden"
			bind:this={fileInput}
			onchange={handleFileChosen}
		/>

		{#if view === 'main'}
			<div
				class="flex flex-col gap-3 sm:flex-row"
				in:fly={{ y: 12, duration: 500, delay: 400, easing: cubicOut }}
			>
				<Button
					size="lg"
					class="flex-1 bg-linear-to-r from-blue-500 to-purple-500 font-bold text-white"
					onclick={startNew}
				>
					<TrainTrack />
					New
				</Button>
				<Button variant="outline" size="lg" class="flex-1" onclick={() => (view = 'load')}>
					<FolderOpen />
					Load
				</Button>
			</div>
		{:else}
			<div class="flex flex-col gap-3" in:fade={{ duration: 300, easing: cubicOut }}>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (view = 'main')}
						aria-label="Back"
					>
						<ChevronLeft />
						Back
					</Button>
					<Button variant="outline" size="sm" class="ml-auto" onclick={() => fileInput?.click()}>
						<Upload />
						Open File…
					</Button>
				</div>

				{#if entries.length > 0}
					<Card class="p-4">
						<div class="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
							My tracks
						</div>
						<div class="flex flex-col gap-1.5">
							{#each entries as entry (entry.key)}
								<div
									class="flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2"
								>
									<button
										type="button"
										class="flex min-w-0 flex-1 flex-col text-left transition-colors hover:text-foreground"
										onclick={() => loadEntry(entry)}
									>
										<span class="truncate text-sm font-medium">{entry.name}</span>
										{#if entry.savedAt}
											<span class="text-xs text-muted-foreground">{fmtTime(entry.savedAt)}</span>
										{/if}
									</button>
									<Button
										variant="outline"
										size="sm"
										onclick={() => loadEntry(entry)}
										title="Open this track"
									>
										<FolderOpen />
										Open
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										class="text-muted-foreground hover:text-destructive"
										onclick={() => deleteEntry(entry.key)}
										aria-label="Delete {entry.name}"
										title="Delete"
									>
										<Trash2 />
									</Button>
								</div>
							{/each}
						</div>
					</Card>
				{:else}
					<p class="rounded-md border border-border/70 bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
						No saved tracks yet. Start a new one, or open a file.
					</p>
				{/if}
			</div>
		{/if}

		{#if message}
			<div
				class="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
				style:background-color={message.kind === 'ok'
					? 'rgb(16 185 129 / 0.12)'
					: 'rgb(239 68 68 / 0.12)'}
				style:color={message.kind === 'ok' ? 'rgb(4 120 87)' : 'rgb(185 28 28)'}
			>
				{#if message.kind === 'ok'}
					<Check class="size-4" />
				{:else}
					<X class="size-4" />
				{/if}
				<span>{message.text}</span>
			</div>
		{/if}
	</div>
</div>
