<script lang="ts">
	import { Collapsible } from "$lib/components/ui/collapsible/index.js";
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	// indexing

	interface ToolProps {
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let { class: className = "", children, ...restProps }: ToolProps = $props();

	const id = $props.id();
</script>

<Collapsible {id} class={cn("not-prose w-full overflow-hidden rounded-xl border", className)} {...restProps}>
	{@render children?.()}
</Collapsible>
