<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Upload, FolderOpen, Trash2, X, Check, TrainTrack } from 'lucide-svelte';
	import {
		listLocalSaves,
		loadLocalByKey,
		readLayoutFromFile,
		applyLayout,
		deleteLocalByKey,
		type SavedEntry
	} from '$lib/railway/persistence';
	import { clearAll } from '$lib/railway/grid.svelte';
	import { clearAllLocos } from '$lib/railway/sim.svelte';

	let { onstart }: { onstart: () => void } = $props();

	let entries = $state<SavedEntry[]>([]);
	let fileInput: HTMLInputElement | null = $state(null);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
		clearAllLocos();
		clearAll();
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
			applyLayout(layout);
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
			applyLayout(layout);
			onstart();
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Import failed.');
		}
	}
</script>

<div
	class="min-h-screen bg-linear-to-b from-background via-background to-muted/40 px-6 py-16 text-foreground"
>
	<div class="mx-auto flex max-w-2xl flex-col gap-8">
		<header class="flex flex-col gap-3 text-center">
			<h1
				class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text font-display text-6xl tracking-tight text-transparent"
			>
				Minirail
			</h1>
			<p class="text-base text-muted-foreground">a super-simple railway sandbox</p>
		</header>

		<div class="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
			<p>
				Create a track using the toolbar, then place a <span class="font-medium text-foreground"
					>Locomotive</span
				>. Set the reverser to forward, engage the throttle, and off you go!
			</p>
			<p>
				Switches are thrown by <kbd
					class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs"
					>Shift + LMB</kbd
				> on the point. The Draw tool can also create switches by dragging onto the side of an existing
				track.
			</p>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row">
			<Button size="lg" class="flex-1 font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white" onclick={startNew}>
				<TrainTrack />
				Create a Track
			</Button>
			<Button variant="outline" size="lg" class="flex-1" onclick={() => fileInput?.click()}>
				<Upload />
				Load from File...
			</Button>
			<input
				type="file"
				accept=".json,application/json"
				class="hidden"
				bind:this={fileInput}
				onchange={handleFileChosen}
			/>
		</div>

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

		{#if entries.length > 0}
			<Card class="p-4">
				<div class="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
					Local Saves
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
								title="Load this layout"
							>
								<FolderOpen />
								Load
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
		{/if}
	</div>
</div>
