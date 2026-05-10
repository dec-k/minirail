<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet } = $props();
</script>

<div
	class={cn('rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm', className)}
	{...rest}
>
	{@render children?.()}
</div>
