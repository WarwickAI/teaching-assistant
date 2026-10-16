<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		setPromptInputTextRegistration,
		type PromptInputTextHandle,
	} from "../context/text-registration.svelte.js";
	import type { Message } from "../context/types.js";

	interface Props {
		class?: string;
		onSubmit: (message: Message, event: SubmitEvent) => void | Promise<void>;
		children?: import("svelte").Snippet;
	}
	// indexing

	let { class: className, onSubmit, children, ...props }: Props = $props();

	let promptTextHandle = $state<PromptInputTextHandle | null>(null);

	setPromptInputTextRegistration({
		register: (handle) => {
			promptTextHandle = handle;
		},
		unregister: (handle) => {
			if (promptTextHandle === handle) {
				promptTextHandle = null;
			}
		},
	});

	let handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		let form = event.currentTarget as HTMLFormElement;
		let text =
			promptTextHandle?.getValue() ?? ((new FormData(form).get("message") as string) || "");

		try {
			await onSubmit({ text }, event);
			// Only clear if submission was successful
			promptTextHandle?.clear();
		} catch (error) {
			// Don't clear on error - user may want to retry
			console.error("Submit failed:", error);
		}
	};
</script>

<form
	class={cn("bg-background w-full overflow-hidden rounded-xl border shadow-sm", className)}
	onsubmit={handleSubmit}
	{...props}
>
	{#if children}
		{@render children()}
	{/if}
</form>
