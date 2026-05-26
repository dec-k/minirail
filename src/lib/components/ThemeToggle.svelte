<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
</script>

<Button
	variant="ghost"
	size="sm"
	onclick={toggleMode}
	class="w-full justify-start"
	aria-label="Toggle theme"
>
	<span class="relative inline-flex size-4 items-center justify-center">
		<Sun
			class="absolute size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
		/>
		<Moon
			class="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
		/>
	</span>
	Toggle theme
</Button>
