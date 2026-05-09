<script lang="ts">
	import {
		sim,
		setReverser,
		setThrottle,
		clearLoco,
		MAX_THROTTLE,
		type Reverser
	} from '$lib/railway/sim.svelte';
	import { clearAll } from '$lib/railway/grid.svelte';
	import type { PieceKind } from '$lib/railway/types';

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

<div class="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white p-3 text-sm">
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

	<div class="flex items-center gap-2">
		<span class="text-slate-700">Reverser</span>
		<div class="flex overflow-hidden rounded border border-slate-300">
			{#each reverserOptions as r}
				<button
					class="px-3 py-1.5 border-r border-slate-300 last:border-r-0 {sim.reverser === r.id
						? 'bg-slate-800 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'} disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!sim.loco}
					onclick={() => setReverser(r.id)}
				>
					{r.label}
				</button>
			{/each}
		</div>
	</div>

	<label class="ml-2 flex items-center gap-2">
		<span class="text-slate-700">Throttle</span>
		<input
			type="range"
			min="0"
			max={MAX_THROTTLE}
			step="1"
			value={sim.throttle}
			disabled={!sim.loco}
			oninput={(e) => setThrottle(+(e.currentTarget as HTMLInputElement).value)}
			class="disabled:opacity-50 disabled:cursor-not-allowed"
		/>
		<span class="w-6 text-right tabular-nums text-slate-600">{sim.throttle}</span>
	</label>

	<div class="mx-2 h-6 w-px bg-slate-300"></div>

	<button
		class="rounded px-3 py-1.5 border bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
		onclick={() => clearLoco()}
	>
		Remove Loco
	</button>
	<button
		class="rounded px-3 py-1.5 border bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
		onclick={() => {
			clearLoco();
			clearAll();
		}}
	>
		Clear Board
	</button>

	{#if sim.loco?.stopped}
		<span class="ml-2 text-rose-600 font-medium">Derailed</span>
	{/if}
</div>
