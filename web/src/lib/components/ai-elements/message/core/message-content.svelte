<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		class?: string;
		children: Snippet;
	}

	let { class: className, children, ...restProps }: Props = $props();
</script>

<div
	class={cn(
		"flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm",
		"group-[.is-user]:bg-black group-[.is-user]:text-white group-[.is-user]:ml-auto group-[.is-user]:rounded-[1.125rem] group-[.is-user]:px-3.5 group-[.is-user]:py-2",
		"group-[.is-assistant]:w-full group-[.is-assistant]:text-foreground",
		className
	)}
	{...restProps}
>
	{@render children()}
</div>
