<script lang="ts">
	import './layout.css';
	import type { LayoutData } from './$types';
	import logo from '$lib/assets/warwick-ai-logo.svg';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex min-h-svh flex-col">
	<div class="pointer-events-none fixed inset-x-0 top-2 z-20 flex justify-center px-4 max-md:hidden">
		<div class="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-base text-foreground md:text-sm shadow-[0_0_28px_2px_rgb(0_0_0/0.08)]">
			<img src={logo} alt="WAI" class="h-2.5 w-auto shrink-0 dark:invert" />
			<span>{data.lessonName || 'teaching assistant'}</span>
		</div>
	</div>
	<div class="flex flex-1 flex-col">
		{@render children()}
	</div>
	<footer class="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-6 py-3 max-md:hidden text-center font-sans text-sm text-muted-foreground">
		<p>© University of Warwick AI Society, 2026</p>
	</footer>
</div>
