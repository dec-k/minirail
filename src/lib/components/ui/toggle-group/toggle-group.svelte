<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const toggleGroupVariants = tv({
		base: 'inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card p-1',
		variants: {
			variant: {
				default: '',
				ghost: 'border-transparent bg-transparent p-0'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type ToggleGroupVariant = VariantProps<typeof toggleGroupVariants>['variant'];
</script>

<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive, type WithoutChild } from 'bits-ui';
	import { setContext } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(),
		type,
		variant = 'default',
		children,
		...rest
	}: WithoutChild<ToggleGroupPrimitive.RootProps> & {
		class?: string;
		variant?: ToggleGroupVariant;
	} = $props();

	setContext('toggle-group-variant', () => variant);
</script>

{#if type === 'single'}
	<ToggleGroupPrimitive.Root
		bind:ref
		bind:value={value as never}
		type="single"
		class={cn(toggleGroupVariants({ variant }), className)}
		{...rest as Record<string, unknown>}
	>
		{@render children?.()}
	</ToggleGroupPrimitive.Root>
{:else}
	<ToggleGroupPrimitive.Root
		bind:ref
		bind:value={value as never}
		type="multiple"
		class={cn(toggleGroupVariants({ variant }), className)}
		{...rest as Record<string, unknown>}
	>
		{@render children?.()}
	</ToggleGroupPrimitive.Root>
{/if}
