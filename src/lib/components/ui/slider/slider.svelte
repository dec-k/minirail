<script lang="ts">
	import { Slider as SliderPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(),
		type,
		...rest
	}: WithoutChildrenOrChild<SliderPrimitive.RootProps> & { class?: string } = $props();

	const thumbCls =
		'border-primary bg-background ring-offset-background focus-visible:ring-ring block size-4 cursor-grab rounded-full border-2 shadow-sm transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-110 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50';
</script>

{#if type === 'single'}
	<SliderPrimitive.Root
		bind:ref
		bind:value={value as never}
		type="single"
		class={cn(
			'relative flex w-full touch-none items-center select-none data-disabled:opacity-50',
			className
		)}
		{...rest as Record<string, unknown>}
	>
		{#snippet children({ thumbItems })}
			<span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
				<SliderPrimitive.Range class="absolute h-full bg-primary" />
			</span>
			{#each thumbItems as thumb (thumb.index)}
				<SliderPrimitive.Thumb index={thumb.index} class={thumbCls} />
			{/each}
		{/snippet}
	</SliderPrimitive.Root>
{:else}
	<SliderPrimitive.Root
		bind:ref
		bind:value={value as never}
		type="multiple"
		class={cn(
			'relative flex w-full touch-none items-center select-none data-disabled:opacity-50',
			className
		)}
		{...rest as Record<string, unknown>}
	>
		{#snippet children({ thumbItems })}
			<span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
				<SliderPrimitive.Range class="absolute h-full bg-primary" />
			</span>
			{#each thumbItems as thumb (thumb.index)}
				<SliderPrimitive.Thumb index={thumb.index} class={thumbCls} />
			{/each}
		{/snippet}
	</SliderPrimitive.Root>
{/if}
