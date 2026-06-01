<script lang="ts">
	import {
		sim,
		setReverser,
		setThrottle,
		setAutoReverse,
		setSwitchLine,
		setLocoName,
		setLocoColor,
		removeLoco,
		addWagon,
		removeWagon,
		THROTTLE_LEVELS
	} from '$lib/railway/sim.svelte';
	import { LOCO_COLORS, type Reverser } from '$lib/railway/types';
	import { Button } from '$lib/components/ui/button';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import {
		Minus,
		Plus,
		ChevronsLeft,
		ChevronsRight,
		Square,
		Trash2,
		Repeat,
		Shuffle,
		ChevronDown,
		Container
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { untrack } from 'svelte';

	type Icon = typeof Minus;

	const reverserOptions: { id: Reverser; label: string; icon: Icon }[] = [
		{ id: -1, label: 'Reverse', icon: ChevronsLeft },
		{ id: 0, label: 'Neutral', icon: Square },
		{ id: 1, label: 'Forward', icon: ChevronsRight }
	];

	// Three throttle notches rendered as > / >> / >>>. The loco snaps to the
	// nearest notch when its stored throttle doesn't land exactly on one.
	const throttleOptions = THROTTLE_LEVELS.map((value, i) => ({
		value,
		label: `Speed ${i + 1}`,
		glyph: '>'.repeat(i + 1)
	}));

	function nearestThrottle(t: number): number {
		return throttleOptions.reduce((best, o) =>
			Math.abs(o.value - t) < Math.abs(best.value - t) ? o : best
		).value;
	}

	// One popup is open at a time, keyed by loco id (null = strip only).
	let openId = $state<number | null>(null);
	let prevCount = 0;

	const openLoco = $derived(sim.locos.find((l) => l.id === openId) ?? null);

	// Auto-open a freshly placed loco, and close the popup if the loco it was
	// showing gets removed. Mutations are untracked so reading openId here doesn't
	// feed back into this effect.
	$effect(() => {
		const ids = sim.locos.map((l) => l.id);
		untrack(() => {
			if (ids.length > prevCount && ids.length > 0) openId = ids[ids.length - 1];
			prevCount = ids.length;
			if (openId !== null && !ids.includes(openId)) openId = null;
		});
	});

	function toggle(id: number) {
		openId = openId === id ? null : id;
	}

	// Display label: the user's name when set, otherwise the stable `Loco {id}`.
	function locoLabel(l: { id: number; name: string }): string {
		return l.name.trim() || `Loco ${l.id}`;
	}

	// Two-step delete: the header trash icon arms a red "Delete?" confirm rather
	// than removing on the first click, so a stray tap where a close button would
	// normally sit can't destroy a loco. The armed state auto-disarms after a few
	// seconds and is cleared whenever the open popup changes.
	let confirmDelete = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

	function clearConfirm() {
		confirmDelete = false;
		if (confirmTimer) {
			clearTimeout(confirmTimer);
			confirmTimer = null;
		}
	}

	function armDelete() {
		confirmDelete = true;
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => {
			confirmDelete = false;
			confirmTimer = null;
		}, 3000);
	}

	function confirmRemove(id: number) {
		clearConfirm();
		removeLoco(id);
	}

	// Reset the armed state when the open popup switches (or closes) so the confirm
	// never carries over to a different loco.
	let lastOpen: number | null = null;
	$effect(() => {
		const cur = openId;
		untrack(() => {
			if (cur !== lastOpen) {
				lastOpen = cur;
				clearConfirm();
			}
		});
	});

	// Loco colour is used as an accent + faint body wash via color-mix so text
	// contrast stays safe across the whole palette and in both themes.
	function popupStyle(color: string): string {
		return `background-color: color-mix(in srgb, ${color} 9%, var(--card)); border-color: color-mix(in srgb, ${color} 45%, var(--border));`;
	}
	function headerStyle(color: string): string {
		return `background-color: color-mix(in srgb, ${color} 18%, var(--card)); border-color: color-mix(in srgb, ${color} 28%, var(--border));`;
	}
	function chipStyle(color: string, active: boolean): string {
		const tint = active ? 24 : 10;
		const border = active ? color : `color-mix(in srgb, ${color} 35%, var(--border))`;
		// Active chip gets a loco-coloured ring (offset against the page bg) rather
		// than the theme ring, so the highlight matches the train it controls.
		const ring = active ? ` box-shadow: 0 0 0 1.5px var(--background), 0 0 0 3.5px ${color};` : '';
		return `background-color: color-mix(in srgb, ${color} ${tint}%, var(--card)); border-color: ${border};${ring}`;
	}
</script>

{#if sim.locos.length > 0}
	<div class="flex flex-col items-center gap-2">
		<!-- The open loco's controls, tinted by its colour. Stays mounted while
		     switching between chips so the content swaps without re-animating. -->
		{#if openLoco}
			<div
				class="w-[min(360px,92vw)] overflow-hidden rounded-xl border shadow-lg"
				style={popupStyle(openLoco.color)}
				in:slide={{ duration: 200, easing: cubicOut, axis: 'y' }}
				out:slide={{ duration: 150, easing: cubicOut, axis: 'y' }}
			>
				<!-- Header: identity + collapse + delete. -->
				<div class="flex items-center gap-2 border-b px-3 py-2" style={headerStyle(openLoco.color)}>
					<span
						class="inline-block size-3.5 shrink-0 rounded-full ring-2 ring-background"
						style="background-color: {openLoco.color}"
						aria-hidden="true"
					></span>
					<input
						type="text"
						value={openLoco.name}
						oninput={(e) => setLocoName(openLoco.id, e.currentTarget.value)}
						placeholder="Loco {openLoco.id}"
						aria-label="Name for Loco {openLoco.id}"
						maxlength="40"
						class="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-0.5 text-sm font-semibold outline-none placeholder:font-semibold placeholder:text-foreground/55 hover:bg-foreground/5 focus:bg-foreground/10"
					/>
					<Button
						variant="ghost"
						size="icon-sm"
						class="ml-auto"
						onclick={() => (openId = null)}
						title="Collapse controls"
						aria-label="Collapse Loco {openLoco.id} controls"
					>
						<ChevronDown />
					</Button>
					{#if confirmDelete}
						<Button
							variant="destructive"
							size="sm"
							class="-mr-1 h-7 px-2"
							onclick={() => confirmRemove(openLoco.id)}
							aria-label="Confirm remove Loco {openLoco.id}"
							title="Tap again to remove this locomotive"
						>
							Delete?
						</Button>
					{:else}
						<Button
							variant="ghost"
							size="icon-sm"
							class="-mr-1 text-muted-foreground hover:text-destructive"
							onclick={armDelete}
							aria-label="Remove Loco {openLoco.id}"
							title="Remove locomotive"
						>
							<Trash2 />
						</Button>
					{/if}
				</div>

				<div class="flex flex-col gap-2 p-3">
					<!-- Colour palette: pick from the shared loco palette. The selected
					     swatch gets a ring offset against the body so it reads as active. -->
					<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Loco colour">
						{#each LOCO_COLORS as c (c)}
							{@const selected = openLoco.color === c}
							<button
								type="button"
								class="size-6 rounded-full border border-black/10 transition active:scale-90 {selected
									? ''
									: 'hover:scale-110'}"
								style="background-color: {c};{selected
									? ` box-shadow: 0 0 0 2px var(--card), 0 0 0 4px ${c};`
									: ''}"
								onclick={() => setLocoColor(openLoco.id, c)}
								aria-label="Set colour {c}"
								aria-pressed={selected}
							></button>
						{/each}
					</div>

					<!-- Drive controls: direction + speed. Segments stretch full-width on
					     mobile, shrink to natural width on desktop. -->
					<div class="flex flex-wrap items-center justify-between gap-2">
						<ToggleGroup.Root
							type="single"
							value={String(openLoco.reverser)}
							onValueChange={(v) => v && setReverser(openLoco.id, Number(v) as Reverser)}
							aria-label="Direction"
							class="sm:flex-none"
						>
							{#each reverserOptions as r (r.id)}
								<ToggleGroup.Item
									value={String(r.id)}
									aria-label={r.label}
									title={r.label}
									class="h-9 flex-1 sm:flex-none"
								>
									<r.icon />
								</ToggleGroup.Item>
							{/each}
						</ToggleGroup.Root>

						<ToggleGroup.Root
							type="single"
							value={String(nearestThrottle(openLoco.throttle))}
							onValueChange={(v) => v && setThrottle(openLoco.id, Number(v))}
							aria-label="Speed"
							class="sm:flex-none"
						>
							{#each throttleOptions as o (o.value)}
								<ToggleGroup.Item
									value={String(o.value)}
									aria-label={o.label}
									title={o.label}
									class="h-9 flex-1 sm:flex-none"
								>
									<span class="font-mono text-sm font-bold tracking-tighter">{o.glyph}</span>
								</ToggleGroup.Item>
							{/each}
						</ToggleGroup.Root>
					</div>

					<!-- Secondary: wagon count + behaviour toggles. -->
					<div class="flex items-center gap-2">
						<div class="flex items-center gap-1.5">
							<Container class="size-4 text-muted-foreground" aria-label="Wagons" />
							<Button
								variant="outline"
								size="icon"
								onclick={() => removeWagon(openLoco.id)}
								disabled={openLoco.wagons.length === 0}
								aria-label="Remove wagon from Loco {openLoco.id}"
							>
								<Minus />
							</Button>
							<span class="w-5 text-center text-sm tabular-nums">{openLoco.wagons.length}</span>
							<Button
								variant="outline"
								size="icon"
								onclick={() => addWagon(openLoco.id)}
								aria-label="Add wagon to Loco {openLoco.id}"
							>
								<Plus />
							</Button>
						</div>

						<div class="ml-auto flex items-center gap-1">
							<Button
								variant={openLoco.autoReverse ? 'default' : 'outline'}
								size="icon"
								onclick={() => setAutoReverse(openLoco.id, !openLoco.autoReverse)}
								aria-pressed={openLoco.autoReverse}
								aria-label="Auto-reverse on dead end for Loco {openLoco.id}"
								title="Auto-reverse on dead end"
							>
								<Repeat />
							</Button>
							<Button
								variant={openLoco.switchLine ? 'default' : 'outline'}
								size="icon"
								onclick={() => setSwitchLine(openLoco.id, !openLoco.switchLine)}
								aria-pressed={openLoco.switchLine}
								aria-label="Toggle switches on pass for Loco {openLoco.id}"
								title="Toggle switches when leaving"
							>
								<Shuffle />
							</Button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Colour-coded chip strip; one chip per loco. Scrolls horizontally so a
		     long roster never wraps over the board. -->
		<div
			class="flex max-w-[92vw] items-center gap-1.5 overflow-x-auto rounded-full border border-border/70 bg-card/95 p-1.5 shadow-md backdrop-blur"
		>
			{#each sim.locos as loco (loco.id)}
				{@const active = loco.id === openId}
				<button
					type="button"
					class="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold tabular-nums transition {active
						? ''
						: 'hover:brightness-95'}"
					style={chipStyle(loco.color, active)}
					onclick={() => toggle(loco.id)}
					aria-pressed={active}
					title={locoLabel(loco)}
				>
					<span
						class="size-2.5 shrink-0 rounded-full ring-1 ring-background"
						style="background-color: {loco.color}"
						aria-hidden="true"
					></span>
					<span class="max-w-[10ch] truncate">{loco.name.trim() || loco.id}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}
