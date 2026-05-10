<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLHeadingElement> & { class?: string; children?: Snippet } = $props();
</script>

<h3 class={cn('text-base leading-none font-semibold tracking-tight', className)} {...rest}>
	{@render children?.()}
</h3>
