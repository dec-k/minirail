<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Popover from '$lib/components/ui/popover';
	import {
		Menu,
		FilePlus,
		FolderOpen,
		Save,
		Share2,
		Download,
		Copy,
		ChevronRight,
		Upload,
		FileJson,
		Trash2,
		Check,
		X,
		Sun,
		Moon
	} from 'lucide-svelte';
	import { toggleMode } from 'mode-watcher';
	import {
		saveAs,
		saveCurrent,
		localSaveExists,
		listLocalSaves,
		loadLocalByKey,
		deleteLocalByKey,
		downloadLayout,
		readLayoutFromFile,
		applyLayout,
		serializeLayout,
		exportToJsonString,
		parseLayout,
		newDocument,
		type SavedEntry
	} from '$lib/railway/persistence';
	import { doc } from '$lib/railway/doc.svelte';

	let menuOpen = $state(false);
	let openSubOpen = $state(false);
	let saveAsOpen = $state(false);
	let exportSubOpen = $state(false);

	let entries = $state<SavedEntry[]>([]);
	let saveAsName = $state('');
	let saveAsInput: HTMLInputElement | null = $state(null);
	let pasteOpen = $state(false);
	let pasteText = $state('');
	let fileInput: HTMLInputElement | null = $state(null);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

	function refresh() {
		entries = listLocalSaves();
	}

	$effect(() => {
		if (openSubOpen) refresh();
	});

	$effect(() => {
		if (saveAsOpen) {
			saveAsName = doc.name ?? '';
			queueMicrotask(() => saveAsInput?.focus());
		}
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

	function confirmDiscardIfDirty(action: string): boolean {
		if (!doc.dirty) return true;
		return window.confirm(`You have unsaved changes. ${action} anyway?`);
	}

	function handleNew() {
		if (!confirmDiscardIfDirty('Start a new track')) return;
		newDocument();
		menuOpen = false;
	}

	function handleSave() {
		if (!doc.key) {
			// Untitled doc — fall through to Save As prompt.
			saveAsOpen = true;
			return;
		}
		try {
			saveCurrent(doc.key, doc.name ?? doc.key);
			flash('ok', `Saved "${doc.name ?? doc.key}".`);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Save failed.');
		}
	}

	function handleSaveAs() {
		const trimmed = saveAsName.trim();
		if (!trimmed) {
			flash('err', 'Name cannot be empty.');
			return;
		}
		if (localSaveExists(trimmed) && trimmed !== doc.key) {
			const ok = window.confirm(`"${trimmed}" already exists. Overwrite it?`);
			if (!ok) return;
		}
		try {
			saveAs(trimmed);
			saveAsOpen = false;
			saveAsName = '';
			flash('ok', `Saved "${trimmed}".`);
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Save failed.');
		}
	}

	function handleLoad(entry: SavedEntry) {
		if (!confirmDiscardIfDirty(`Open "${entry.name}"`)) return;
		try {
			const layout = loadLocalByKey(entry.key);
			if (!layout) {
				flash('err', `"${entry.name}" not found.`);
				refresh();
				return;
			}
			applyLayout(layout, entry.key);
			openSubOpen = false;
			menuOpen = false;
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Open failed.');
		}
	}

	function handleDelete(entry: SavedEntry) {
		const ok = window.confirm(`Delete "${entry.name}" permanently?`);
		if (!ok) return;
		deleteLocalByKey(entry.key);
		refresh();
	}

	function handleDownload() {
		const target = doc.name?.trim() || `Railway ${new Date().toLocaleString()}`;
		downloadLayout(serializeLayout(target));
		exportSubOpen = false;
		flash('ok', 'Downloaded.');
	}

	async function handleCopy() {
		const target = doc.name?.trim() || `Railway ${new Date().toLocaleString()}`;
		const json = exportToJsonString(serializeLayout(target));
		try {
			await navigator.clipboard.writeText(json);
			exportSubOpen = false;
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
		if (!confirmDiscardIfDirty('Open this file')) return;
		try {
			const layout = await readLayoutFromFile(file);
			applyLayout(layout, null);
			openSubOpen = false;
			menuOpen = false;
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Open failed.');
		}
	}

	function handlePasteImport() {
		if (!confirmDiscardIfDirty('Open pasted JSON')) return;
		try {
			const layout = parseLayout(pasteText);
			applyLayout(layout, null);
			pasteOpen = false;
			pasteText = '';
			openSubOpen = false;
			menuOpen = false;
		} catch (err) {
			flash('err', err instanceof Error ? err.message : 'Open failed.');
		}
	}
</script>

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
	<Popover.Content class="w-56 p-1.5">
		<div class="flex flex-col gap-0.5">
			<Button variant="ghost" size="sm" onclick={handleNew} class="w-full justify-start">
				<FilePlus />
				New
			</Button>

			<Popover.Root bind:open={openSubOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="sm" {...props} class="w-full justify-start">
							<FolderOpen />
							Open
							<ChevronRight class="ml-auto opacity-60" />
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-80" side="left" align="start" sideOffset={8}>
					<div class="flex flex-col gap-3">
						<div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							My tracks
						</div>
						{#if entries.length === 0}
							<p class="text-sm text-muted-foreground">No saved tracks yet.</p>
						{:else}
							<div class="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
								{#each entries as entry (entry.key)}
									{@const isCurrent = entry.key === doc.key}
									<div
										class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 {isCurrent
											? 'border-primary/50 bg-primary/5'
											: 'border-border/70 bg-muted/40'}"
									>
										<button
											type="button"
											class="flex min-w-0 flex-1 flex-col text-left transition-colors hover:text-foreground"
											onclick={() => handleLoad(entry)}
										>
											<span class="truncate text-sm font-medium">{entry.name}</span>
											{#if entry.savedAt}
												<span class="text-xs text-muted-foreground">{fmtTime(entry.savedAt)}</span>
											{/if}
										</button>
										<Button
											variant="ghost"
											size="icon-sm"
											class="text-muted-foreground hover:text-destructive"
											onclick={() => handleDelete(entry)}
											aria-label="Delete {entry.name}"
											title="Delete"
										>
											<Trash2 />
										</Button>
									</div>
								{/each}
							</div>
						{/if}

						<Separator />

						<div class="flex flex-col gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onclick={() => fileInput?.click()}
								class="justify-start"
							>
								<Upload />
								Open file…
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									pasteOpen = !pasteOpen;
									if (!pasteOpen) pasteText = '';
								}}
								class="justify-start"
							>
								<FileJson />
								Paste from clipboard
							</Button>
							<input
								type="file"
								accept=".json,application/json"
								class="hidden"
								bind:this={fileInput}
								onchange={handleFileChosen}
							/>
						</div>
						{#if pasteOpen}
							<textarea
								bind:value={pasteText}
								placeholder="Paste a layout JSON here..."
								rows="5"
								class="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							></textarea>
							<div class="flex justify-end gap-2">
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
								<Button size="sm" onclick={handlePasteImport} disabled={!pasteText.trim()}>
									Open
								</Button>
							</div>
						{/if}
					</div>
				</Popover.Content>
			</Popover.Root>

			<Button variant="ghost" size="sm" onclick={handleSave} class="w-full justify-start">
				<Save />
				Save
			</Button>

			<Popover.Root bind:open={saveAsOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="sm" {...props} class="w-full justify-start">
							<Save />
							Save As…
							<ChevronRight class="ml-auto opacity-60" />
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-72" side="left" align="start" sideOffset={8}>
					<div class="flex flex-col gap-2">
						<label
							class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
							for="save-as-name"
						>
							Track name
						</label>
						<input
							id="save-as-name"
							type="text"
							placeholder="My track"
							bind:value={saveAsName}
							bind:this={saveAsInput}
							onkeydown={(e) => {
								if (e.key === 'Enter') handleSaveAs();
								if (e.key === 'Escape') {
									saveAsOpen = false;
									saveAsName = '';
								}
							}}
							class="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						/>
						<div class="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								onclick={() => {
									saveAsOpen = false;
									saveAsName = '';
								}}
							>
								Cancel
							</Button>
							<Button size="sm" onclick={handleSaveAs} disabled={!saveAsName.trim()}>Save</Button>
						</div>
					</div>
				</Popover.Content>
			</Popover.Root>

			<Separator class="my-1" />

			<Popover.Root bind:open={exportSubOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="sm" {...props} class="w-full justify-start">
							<Share2 />
							Export
							<ChevronRight class="ml-auto opacity-60" />
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-56 p-1.5" side="left" align="start" sideOffset={8}>
					<div class="flex flex-col gap-0.5">
						<Button variant="ghost" size="sm" onclick={handleDownload} class="w-full justify-start">
							<Download />
							Download file
						</Button>
						<Button variant="ghost" size="sm" onclick={handleCopy} class="w-full justify-start">
							<Copy />
							Copy to clipboard
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>

			<Separator class="my-1" />

			<Button
				variant="ghost"
				size="sm"
				onclick={toggleMode}
				class="w-full justify-start"
				aria-label="Change theme"
			>
				<span class="relative inline-flex size-4 items-center justify-center">
					<Sun
						class="absolute size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
					/>
					<Moon
						class="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
					/>
				</span>
				Change theme
			</Button>
		</div>

		{#if message}
			<div
				class="mt-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs"
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
	</Popover.Content>
</Popover.Root>
