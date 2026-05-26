<script lang="ts">
	import {
		sim,
		setReverser,
		setThrottle,
		setAutoReverse,
		setSwitchLine,
		removeLoco,
		addWagon,
		removeWagon,
		MAX_THROTTLE
	} from '$lib/railway/sim.svelte';
	import type { Reverser } from '$lib/railway/types';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Slider } from '$lib/components/ui/slider';
	import {
		Minus,
		Plus,
		ChevronsLeft,
		ChevronsRight,
		Square,
		X,
		Repeat,
		Shuffle,
		ChevronDown,
		Train
	} from 'lucide-svelte';

	type Icon = typeof Minus;

	const reverserOptions: { id: Reverser; label: string; icon: Icon }[] = [
		{ id: -1, label: 'Reverse', icon: ChevronsLeft },
		{ id: 0, label: 'Neutral', icon: Square },
		{ id: 1, label: 'Forward', icon: ChevronsRight }
	];

	let collapsed = $state(false);
	let prevCount = 0;

	// Auto-expand on the 0→1 transition so a freshly placed loco isn't hidden
	// under the train-icon stub. User-driven collapse otherwise persists.
	$effect(() => {
		const n = sim.locos.length;
		if (prevCount === 0 && n > 0) collapsed = false;
		prevCount = n;
	});
</script>

{#if sim.locos.length > 0}
	{#if collapsed}
		<Button
			variant="default"
			size="icon"
			class="relative size-12 rounded-full shadow-md"
			onclick={() => (collapsed = false)}
			title="Show loco controls"
			aria-label="Show loco controls"
		>
			<Train class="size-5" />
			{#if sim.locos.length > 1}
				<span
					class="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-xs font-semibold text-foreground tabular-nums ring-1 ring-border"
				>
					{sim.locos.length}
				</span>
			{/if}
		</Button>
	{:else}
		<Card class="flex max-h-[40vh] flex-col gap-2 overflow-y-auto p-2">
			<div class="-mb-1 flex justify-end">
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => (collapsed = true)}
					title="Collapse panel"
					aria-label="Collapse loco panel"
				>
					<ChevronDown />
				</Button>
			</div>
		{#each sim.locos as loco (loco.id)}
			<div
				class="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2"
			>
				<div class="flex items-center gap-2">
					<span
						class="inline-block size-3.5 rounded-full ring-2 ring-background"
						style="background-color: {loco.color}"
						aria-hidden="true"
					></span>
					<span class="text-sm font-semibold tabular-nums">Loco {loco.id}</span>
				</div>

				<ToggleGroup.Root
					type="single"
					value={String(loco.reverser)}
					onValueChange={(v) => v && setReverser(loco.id, Number(v) as Reverser)}
					aria-label="Reverser"
				>
					{#each reverserOptions as r (r.id)}
						<ToggleGroup.Item value={String(r.id)} aria-label={r.label} title={r.label}>
							<r.icon />
						</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>

				<div class="flex min-w-44 items-center gap-2">
					<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						Throttle
					</span>
					<Slider
						type="single"
						value={loco.throttle}
						onValueChange={(v) => setThrottle(loco.id, v)}
						min={0}
						max={MAX_THROTTLE}
						step={1}
						class="w-28"
					/>
					<span class="w-5 text-right text-sm tabular-nums">{loco.throttle}</span>
				</div>

				<div class="flex items-center gap-1">
					<Button
						variant={loco.autoReverse ? 'default' : 'outline'}
						size="icon-sm"
						onclick={() => setAutoReverse(loco.id, !loco.autoReverse)}
						aria-pressed={loco.autoReverse}
						aria-label="Auto-reverse on dead end for Loco {loco.id}"
						title="Auto-reverse on dead end"
					>
						<Repeat />
					</Button>
					<Button
						variant={loco.switchLine ? 'default' : 'outline'}
						size="icon-sm"
						onclick={() => setSwitchLine(loco.id, !loco.switchLine)}
						aria-pressed={loco.switchLine}
						aria-label="Toggle switches on pass for Loco {loco.id}"
						title="Toggle switches when leaving"
					>
						<Shuffle />
					</Button>
				</div>

				<div class="flex items-center gap-1.5">
					<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						Wagons
					</span>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={() => removeWagon(loco.id)}
						disabled={loco.wagons.length === 0}
						aria-label="Remove wagon from Loco {loco.id}"
					>
						<Minus />
					</Button>
					<span class="w-5 text-center text-sm tabular-nums">{loco.wagons.length}</span>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={() => addWagon(loco.id)}
						aria-label="Add wagon to Loco {loco.id}"
					>
						<Plus />
					</Button>
				</div>

				<Button
					variant="ghost"
					size="icon-sm"
					class="ml-auto text-muted-foreground hover:text-destructive"
					onclick={() => removeLoco(loco.id)}
					aria-label="Remove Loco {loco.id}"
					title="Remove locomotive"
				>
					<X />
				</Button>
			</div>
		{/each}
		</Card>
	{/if}
{/if}
