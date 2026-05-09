<script lang="ts">
	import { sim, play, pause, setSpeed, clearLoco } from '$lib/railway/sim.svelte';
	import { clearAll } from '$lib/railway/grid.svelte';
	import type { PieceKind } from '$lib/railway/types';

	type Tool = PieceKind | 'loco' | 'erase';

	let { tool = $bindable() }: { tool: Tool } = $props();

	const tools: { id: Tool; label: string }[] = [
		{ id: 'straight', label: 'Straight' },
		{ id: 'curve', label: 'Curve' },
		{ id: 'loco', label: 'Locomotive' },
		{ id: 'erase', label: 'Erase' }
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

	<button
		class="rounded px-3 py-1.5 border bg-emerald-600 text-white border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
		disabled={sim.running || !sim.loco}
		onclick={play}
	>
		Play
	</button>
	<button
		class="rounded px-3 py-1.5 border bg-amber-600 text-white border-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
		disabled={!sim.running}
		onclick={pause}
	>
		Pause
	</button>

	<label class="ml-2 flex items-center gap-2">
		<span class="text-slate-700">Speed</span>
		<input
			type="range"
			min="0.5"
			max="8"
			step="0.5"
			value={sim.speed}
			oninput={(e) => setSpeed(+(e.currentTarget as HTMLInputElement).value)}
		/>
		<span class="w-8 text-right tabular-nums text-slate-600">{sim.speed.toFixed(1)}</span>
	</label>

	<div class="mx-2 h-6 w-px bg-slate-300"></div>

	<button
		class="rounded px-3 py-1.5 border bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
		onclick={() => {
			pause();
			clearLoco();
		}}
	>
		Remove Loco
	</button>
	<button
		class="rounded px-3 py-1.5 border bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
		onclick={() => {
			pause();
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
