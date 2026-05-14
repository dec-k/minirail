<script lang="ts">
	import {
		sim,
		setReverser,
		setThrottle,
		removeLoco,
		clearAllLocos,
		addWagon,
		removeWagon,
		MAX_THROTTLE
	} from '$lib/railway/sim.svelte';
	import { clearAll } from '$lib/railway/grid.svelte';
	import type { DecorationKind, PieceKind, Reverser } from '$lib/railway/types';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Slider } from '$lib/components/ui/slider';
	import {
		Pencil,
		Minus,
		Spline,
		Eraser,
		Plus,
		Trash2,
		TrainFront,
		ChevronsLeft,
		ChevronsRight,
		Square,
		X,
		CornerDownRight,
		CornerDownLeft,
		Building2,
		Trees,
		TreePine,
		Building,
		Waves,
		Sprout,
		Mountain
	} from 'lucide-svelte';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw' | 'station' | 'decorate';
	type Icon = typeof Pencil;

	let {
		tool = $bindable(),
		decorationKind = $bindable()
	}: { tool: Tool; decorationKind: DecorationKind } = $props();

	const tools: { id: Tool; label: string; icon: Icon }[] = [
		{ id: 'draw', label: 'Draw', icon: Pencil },
		{ id: 'straight', label: 'Straight', icon: Minus },
		{ id: 'curve', label: 'Curve', icon: Spline },
		{ id: 'switch-left', label: 'Switch L', icon: CornerDownLeft },
		{ id: 'switch-right', label: 'Switch R', icon: CornerDownRight },
		{ id: 'loco', label: 'Locomotive', icon: TrainFront },
		{ id: 'station', label: 'Station', icon: Building2 },
		{ id: 'decorate', label: 'Decorate', icon: Trees },
		{ id: 'erase', label: 'Erase', icon: Eraser }
	];

	const decorationOptions: { id: DecorationKind; label: string; icon: Icon }[] = [
		{ id: 'tree', label: 'Tree', icon: TreePine },
		{ id: 'building', label: 'Building', icon: Building },
		{ id: 'water', label: 'Water', icon: Waves },
		{ id: 'grass', label: 'Grass', icon: Sprout },
		{ id: 'stone', label: 'Stone', icon: Mountain }
	];

	const reverserOptions: { id: Reverser; label: string; icon: Icon }[] = [
		{ id: -1, label: 'Reverse', icon: ChevronsLeft },
		{ id: 0, label: 'Neutral', icon: Square },
		{ id: 1, label: 'Forward', icon: ChevronsRight }
	];
</script>

<Card class="p-3">
	<div class="flex flex-wrap items-center gap-3">
		<ToggleGroup.Root
			type="single"
			value={tool}
			onValueChange={(v) => v && (tool = v as Tool)}
			aria-label="Select tool"
		>
			{#each tools as t (t.id)}
				<ToggleGroup.Item value={t.id} aria-label={t.label} title={t.label}>
					<t.icon />
					<span class="hidden sm:inline">{t.label}</span>
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>

		<Separator orientation="vertical" class="h-7!" />

		<Button
			variant="destructive"
			size="sm"
			onclick={() => {
				clearAllLocos();
				clearAll();
			}}
		>
			<Trash2 />
			Clear board
		</Button>
	</div>

	{#if tool === 'decorate'}
		<div
			class="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2"
		>
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
				Scenery
			</span>
			<ToggleGroup.Root
				type="single"
				value={decorationKind}
				onValueChange={(v) => v && (decorationKind = v as DecorationKind)}
				aria-label="Select scenery kind"
			>
				{#each decorationOptions as d (d.id)}
					<ToggleGroup.Item value={d.id} aria-label={d.label} title={d.label}>
						<d.icon />
						<span class="hidden sm:inline">{d.label}</span>
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
			<span class="text-xs text-muted-foreground">
				{decorationKind === 'grass' || decorationKind === 'stone'
					? 'Click any cell to place ground cover under track. Click again to remove.'
					: 'Click an empty cell to place. Click again to remove.'}
			</span>
		</div>
	{/if}

	{#if sim.locos.length === 0}
		<div
			class="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
		>
			<TrainFront class="size-4" />
			<span>Place a locomotive on the board to add controls.</span>
		</div>
	{:else}
		<div class="mt-3 flex flex-col gap-2">
			{#each sim.locos as loco (loco.id)}
				<div
					class="flex flex-wrap items-center gap-4 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5"
				>
					<div class="flex items-center gap-2">
						<span
							class="inline-block size-3.5 rounded-full ring-2 ring-background"
							style="background-color: {loco.color}"
							aria-hidden="true"
						></span>
						<span class="text-sm font-semibold tabular-nums">Loco {loco.id}</span>
						{#if loco.stopped}
							<span
								class="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
							>
								Derailed
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Reverser
						</span>
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
					</div>

					<div class="flex min-w-48 flex-1 items-center gap-3">
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
							class="flex-1"
						/>
						<span class="w-6 text-right text-sm font-medium text-foreground tabular-nums">
							{loco.throttle}
						</span>
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
		</div>
	{/if}
</Card>
