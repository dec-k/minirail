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
	import type { PieceKind, Reverser } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase' | 'draw';

	let { tool = $bindable() }: { tool: Tool } = $props();

	const tools: { id: Tool; label: string }[] = [
		{ id: 'draw', label: 'Draw' },
		{ id: 'straight', label: 'Straight' },
		{ id: 'curve', label: 'Curve' },
		{ id: 'switch-left', label: 'Switch L' },
		{ id: 'switch-right', label: 'Switch R' },
		{ id: 'loco', label: 'Locomotive' },
		{ id: 'erase', label: 'Erase' }
	];

	const reverserOptions: { id: Reverser; label: string }[] = [
		{ id: -1, label: 'Reverse' },
		{ id: 0, label: 'Neutral' },
		{ id: 1, label: 'Forward' }
	];
</script>

<div class="flex flex-col gap-2 rounded-md border border-slate-300 bg-white p-3 text-sm">
	<div class="flex flex-wrap items-center gap-2">
		<div class="flex gap-1">
			{#each tools as t}
				<button
					class="rounded border px-3 py-1.5 {tool === t.id
						? 'border-slate-800 bg-slate-800 text-white'
						: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'}"
					onclick={() => (tool = t.id)}
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="mx-2 h-6 w-px bg-slate-300"></div>

		<button
			class="rounded border border-rose-300 bg-white px-3 py-1.5 text-rose-700 hover:bg-rose-50"
			onclick={() => {
				clearAllLocos();
				clearAll();
			}}
		>
			Clear Board
		</button>
	</div>

	{#if sim.locos.length === 0}
		<div class="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-500">
			Place a locomotive on the board to add controls.
		</div>
	{:else}
		<div class="flex flex-col gap-1.5">
			{#each sim.locos as loco (loco.id)}
				<div
					class="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2"
				>
					<div class="flex items-center gap-2">
						<span
							class="inline-block h-4 w-4 rounded-full border border-slate-400"
							style="background-color: {loco.color}"
							aria-hidden="true"
						></span>
						<span class="font-medium text-slate-800">Loco {loco.id}</span>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-slate-700">Reverser</span>
						<div class="flex overflow-hidden rounded border border-slate-300">
							{#each reverserOptions as r}
								<button
									class="border-r border-slate-300 px-3 py-1 last:border-r-0 {loco.reverser === r.id
										? 'bg-slate-800 text-white'
										: 'bg-white text-slate-800 hover:bg-slate-100'}"
									onclick={() => setReverser(loco.id, r.id)}
								>
									{r.label}
								</button>
							{/each}
						</div>
					</div>

					<label class="flex items-center gap-2">
						<span class="text-slate-700">Throttle</span>
						<input
							type="range"
							min="0"
							max={MAX_THROTTLE}
							step="1"
							value={loco.throttle}
							oninput={(e) => setThrottle(loco.id, +(e.currentTarget as HTMLInputElement).value)}
						/>
						<span class="w-6 text-right text-slate-600 tabular-nums">{loco.throttle}</span>
					</label>

					<div class="flex items-center gap-1.5">
						<span class="text-slate-700">Wagons</span>
						<button
							class="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={() => removeWagon(loco.id)}
							disabled={loco.wagons.length === 0}
							aria-label="Remove wagon from Loco {loco.id}"
						>
							−
						</button>
						<span class="w-5 text-center text-slate-700 tabular-nums">{loco.wagons.length}</span>
						<button
							class="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-800 hover:bg-slate-100"
							onclick={() => addWagon(loco.id)}
							aria-label="Add wagon to Loco {loco.id}"
						>
							+
						</button>
					</div>

					{#if loco.stopped}
						<span class="font-medium text-rose-600">Derailed</span>
					{/if}

					<button
						class="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100"
						onclick={() => removeLoco(loco.id)}
						aria-label="Remove Loco {loco.id}"
					>
						Remove
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
