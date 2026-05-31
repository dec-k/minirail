<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Sun, Sunset, Moon, Sunrise } from 'lucide-svelte';
	import { atmosphere, setTimeOfDay, type TimeOfDay } from '$lib/railway/atmosphere.svelte';

	type Icon = typeof Sun;
	const options: { id: TimeOfDay; label: string; icon: Icon }[] = [
		{ id: 'day', label: 'Day', icon: Sun },
		{ id: 'dusk', label: 'Dusk', icon: Sunset },
		{ id: 'night', label: 'Night', icon: Moon },
		{ id: 'dawn', label: 'Dawn', icon: Sunrise }
	];
</script>

<Card class="p-1.5">
	<ToggleGroup.Root
		type="single"
		value={atmosphere.timeOfDay}
		onValueChange={(v) => v && setTimeOfDay(v as TimeOfDay)}
		aria-label="Time of day"
		class="border-none bg-transparent p-0"
	>
		{#each options as o (o.id)}
			<ToggleGroup.Item value={o.id} aria-label={o.label} title={o.label} class="size-9 p-0">
				<o.icon class="size-4" />
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
</Card>
