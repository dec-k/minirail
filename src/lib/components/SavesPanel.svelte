<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import {
		Save,
		FolderOpen,
		Download,
		Upload,
		Trash2,
		Copy,
		FileJson,
		Check,
		X
	} from 'lucide-svelte';
	import {
		saveLocal,
		listLocalSaves,
		loadLocal,
		deleteLocal,
		downloadLayout,
		readLayoutFromFile,
		applyLayout,
		serializeLayout,
		exportToJsonString,
		parseLayout,
		type SavedEntry
	} from '$lib/railway/persistence';

	let name = $state('');
	let entries = $state<SavedEntry[]>([]);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
	let pasteOpen = $state(false);
	let pasteText = $state('');
	let fileInput: HTMLInputElement | null = $state(null);

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

	function handleSave() {
		const target = name.trim() || `Layout ${new Date().toLocaleString()}`;
		try {
			saveLocal(target);
			name = '';
			refresh();
			flash('ok', `Saved "${target}".`);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Save failed.');
		}
	}

	function handleLoad(entryName: string) {
		try {
			const layout = loadLocal(entryName);
			if (!layout) {
				flash('err', `"${entryName}" not found.`);
				return;
			}
			applyLayout(layout);
			flash('ok', `Loaded "${entryName}".`);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Load failed.');
		}
	}

	function handleDelete(entryName: string) {
		deleteLocal(entryName);
		refresh();
		flash('ok', `Deleted "${entryName}".`);
	}

	function handleDownload(entryName: string) {
		try {
			const layout = loadLocal(entryName);
			if (!layout) {
				flash('err', `"${entryName}" not found.`);
				return;
			}
			downloadLayout(layout);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Download failed.');
		}
	}

	function handleDownloadCurrent() {
		const target = name.trim() || `Layout ${new Date().toLocaleString()}`;
		downloadLayout(serializeLayout(target));
	}

	async function handleCopyCurrent() {
		const target = name.trim() || `Layout ${new Date().toLocaleString()}`;
		const json = exportToJsonString(serializeLayout(target));
		try {
			await navigator.clipboard.writeText(json);
			flash('ok', 'JSON copied to clipboard.');
		} catch {
			flash('err', 'Clipboard not available.');
		}
	}

	async function handleFileChosen(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const layout = await readLayoutFromFile(file);
			applyLayout(layout);
			flash('ok', `Loaded "${layout.name}" from file.`);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Import failed.');
		}
	}

	function handlePasteImport() {
		try {
			const layout = parseLayout(pasteText);
			applyLayout(layout);
			pasteOpen = false;
			pasteText = '';
			flash('ok', `Loaded "${layout.name}" from pasted JSON.`);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Import failed.');
		}
	}
</script>

<Card class="p-3">
	<div class="flex flex-wrap items-center gap-2">
		<input
			type="text"
			placeholder="Layout name"
			bind:value={name}
			onkeydown={(e) => {
				if (e.key === 'Enter') handleSave();
			}}
			class="h-8 min-w-44 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		/>
		<Button size="sm" onclick={handleSave}>
			<Save />
			Save
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={handleDownloadCurrent}
			title="Download current layout as JSON"
		>
			<Download />
			Download
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={handleCopyCurrent}
			title="Copy current layout JSON to clipboard"
		>
			<Copy />
			Copy JSON
		</Button>

		<Separator orientation="vertical" class="h-7!" />

		<Button variant="outline" size="sm" onclick={() => fileInput?.click()}>
			<Upload />
			Import file
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				pasteOpen = !pasteOpen;
				if (!pasteOpen) pasteText = '';
			}}
		>
			<FileJson />
			Paste JSON
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
			class="mt-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs"
			class:bg-emerald-500-10={message.kind === 'ok'}
			class:bg-destructive-10={message.kind === 'err'}
			style:background-color={message.kind === 'ok'
				? 'rgb(16 185 129 / 0.12)'
				: 'rgb(239 68 68 / 0.12)'}
			style:color={message.kind === 'ok' ? 'rgb(4 120 87)' : 'rgb(185 28 28)'}
		>
			{#if message.kind === 'ok'}
				<Check class="size-3.5" />
			{:else}
				<X class="size-3.5" />
			{/if}
			<span>{message.text}</span>
		</div>
	{/if}

	{#if pasteOpen}
		<div class="mt-3 flex flex-col gap-2">
			<textarea
				bind:value={pasteText}
				placeholder="Paste a layout JSON here..."
				rows="6"
				class="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			></textarea>
			<div class="flex gap-2">
				<Button size="sm" onclick={handlePasteImport} disabled={!pasteText.trim()}>
					Load pasted layout
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onclick={() => {
						pasteOpen = false;
						pasteText = '';
					}}
				>
					Cancel
				</Button>
			</div>
		</div>
	{/if}

	{#if entries.length > 0}
		<div class="mt-3 flex flex-col gap-1.5">
			<div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
				Saved layouts
			</div>
			{#each entries as entry (entry.name)}
				<div
					class="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 py-1.5"
				>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm font-medium">{entry.name}</span>
						{#if entry.savedAt}
							<span class="text-xs text-muted-foreground">{fmtTime(entry.savedAt)}</span>
						{/if}
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={() => handleLoad(entry.name)}
						title="Load this layout"
					>
						<FolderOpen />
						Load
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={() => handleDownload(entry.name)}
						aria-label="Download {entry.name}"
						title="Download as JSON"
					>
						<Download />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						class="text-muted-foreground hover:text-destructive"
						onclick={() => handleDelete(entry.name)}
						aria-label="Delete {entry.name}"
						title="Delete"
					>
						<Trash2 />
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</Card>
