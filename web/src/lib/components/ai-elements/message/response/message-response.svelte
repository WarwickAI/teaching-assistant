<script lang="ts">
	import { Streamdown, createMathPlugin, type StreamdownProps } from "streamdown-svelte";

	import githubLightDefault from "@shikijs/themes/github-light-default";
	import { cn } from "$lib/utils.js";
	type Props = StreamdownProps;
	const plugins = { math: createMathPlugin({ singleDollarTextMath: true }) };

	let { content, class: className, ...rest }: Props = $props();
</script>

<div class={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
	<!-- One rhythm: 12px between blocks (paragraphs, lists), 6px between list items. -->
	<Streamdown
		class="flex flex-col gap-3 [&_li]:py-0 [&_li+li]:mt-1.5"
		{content}
		{plugins}
		baseTheme="shadcn"
		shikiTheme="github-light-default"
		shikiThemes={{
			"github-light-default": githubLightDefault,
		}}
		{...rest}
	/>
</div>
