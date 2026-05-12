<script lang="ts">
	import { Popover as PopoverPrimitive, type WithoutChild } from 'bits-ui';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 6,
		align = 'end',
		children,
		...rest
	}: WithoutChild<PopoverPrimitive.ContentProps> & { class?: string } = $props();
</script>

<PopoverPrimitive.Portal>
	<PopoverPrimitive.Content
		bind:ref
		{sideOffset}
		{align}
		class={cn(
			'z-50 w-80 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none',
			className
		)}
		{...rest}
	>
		{@render children?.()}
	</PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
