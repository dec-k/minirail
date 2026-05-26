<script lang="ts">
	import type { DecorationKind, PieceKind } from '$lib/railway/types';
	import { Card } from '$lib/components/ui/card';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import {
		Pencil,
		Minus,
		Spline,
		Eraser,
		TrainFront,
		Building2,
		Trees,
		TreePine,
		Building,
		Waves,
		Sprout,
		Mountain,
		CornerDownRight,
		CornerDownLeft
	} from 'lucide-svelte';
	import { slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

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
</script>

<div class="flex items-start gap-2">
	<Card class="p-1.5">
		<ToggleGroup.Root
			type="single"
			value={tool}
			onValueChange={(v) => v && (tool = v as Tool)}
			aria-label="Select tool"
			class="flex-col border-none bg-transparent p-0"
		>
			{#each tools as t (t.id)}
				<ToggleGroup.Item value={t.id} aria-label={t.label} title={t.label} class="size-9 p-0">
					<t.icon class="size-4" />
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</Card>

	{#if tool === 'decorate'}
		<div
			in:slide={{ duration: 200, easing: cubicOut, axis: 'x' }}
			out:slide={{ duration: 140, easing: cubicOut, axis: 'x' }}
		>
			<div in:fade={{ duration: 180, delay: 40 }} out:fade={{ duration: 100 }}>
				<Card class="p-1.5">
					<ToggleGroup.Root
						type="single"
						value={decorationKind}
						onValueChange={(v) => v && (decorationKind = v as DecorationKind)}
						aria-label="Select scenery kind"
						class="flex-col border-none bg-transparent p-0"
					>
						{#each decorationOptions as d (d.id)}
							<ToggleGroup.Item
								value={d.id}
								aria-label={d.label}
								title={d.label}
								class="size-9 p-0"
							>
								<d.icon class="size-4" />
							</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
				</Card>
			</div>
		</div>
	{/if}
</div>
