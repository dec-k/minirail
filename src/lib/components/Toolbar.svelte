<script lang="ts">
	import {
		sim,
		setReverser,
		setThrottle,
		removeLoco,
		clearAllLocos,
		MAX_THROTTLE
	} from '$lib/railway/sim.svelte';
	import { clearAll } from '$lib/railway/grid.svelte';
	import type { PieceKind, Reverser } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase';

	let { tool = $bindable() }: { tool: Tool } = $props();

	const tools: { id: Tool; label: string }[] = [
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
					class="rounded px-3 py-1.5 border {tool === t.id
						? 'bg-slate-800 text-white border-slate-800'
						: 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'}"
					onclick={() => (tool = t.id)}
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="mx-2 h-6 w-px bg-slate-300"></div>

		<button
			class="rounded px-3 py-1.5 border bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
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
									class="px-3 py-1 border-r border-slate-300 last:border-r-0 {loco.reverser ===
									r.id
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
							oninput={(e) =>
								setThrottle(loco.id, +(e.currentTarget as HTMLInputElement).value)}
						/>
						<span class="w-6 text-right tabular-nums text-slate-600">{loco.throttle}</span>
					</label>

					{#if loco.stopped}
						<span class="text-rose-600 font-medium">Derailed</span>
					{/if}

					<button
						class="ml-auto rounded px-2 py-1 border bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
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
