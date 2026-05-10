<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { getContext, type Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { ToggleGroupVariant } from './toggle-group.svelte';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...rest
	}: ToggleGroupPrimitive.ItemProps & { class?: string; children?: Snippet } = $props();

	const getVariant =
		getContext<() => ToggleGroupVariant>('toggle-group-variant') ?? (() => 'default');
	const variant = $derived(getVariant());
</script>

<ToggleGroupPrimitive.Item
	bind:ref
	class={cn(
		'inline-flex items-center justify-center gap-2 rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
		variant === 'default'
			? 'h-7 px-3 text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm'
			: 'h-8 px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
		className
	)}
	{...rest}
>
	{@render children?.()}
</ToggleGroupPrimitive.Item>
