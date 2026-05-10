<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
</script>

<Button
	variant="outline"
	size="icon"
	onclick={toggleMode}
	aria-label="Toggle theme"
	title="Toggle theme"
>
	<Sun class="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
	<Moon class="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
	<span class="sr-only">Toggle theme</span>
</Button>
