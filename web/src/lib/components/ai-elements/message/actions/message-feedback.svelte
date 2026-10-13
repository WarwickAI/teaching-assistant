<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import { UseClipboard } from '$lib/hooks/use-clipboard.svelte';
	import Action from './message-action.svelte';
	import Actions from './message-actions.svelte';

	let { content }: { content: string } = $props();
	let feedback = $state<'up' | 'down' | null>(null);
	const clipboard = new UseClipboard();
</script>

<Actions>
	<Action tooltip={clipboard.copied ? 'Copied' : 'Copy response'} onclick={() => clipboard.copy(content)}>
		{#if clipboard.copied}<Check class="size-4" />{:else}<Copy class="size-4" />{/if}
	</Action>
	<Action tooltip="Helpful" aria-pressed={feedback === 'up'} class={feedback === 'up' ? 'bg-secondary' : ''} onclick={() => feedback = feedback === 'up' ? null : 'up'}>
		<ThumbsUp class="size-4" />
	</Action>
	<Action tooltip="Not helpful" aria-pressed={feedback === 'down'} class={feedback === 'down' ? 'bg-secondary' : ''} onclick={() => feedback = feedback === 'down' ? null : 'down'}>
		<ThumbsDown class="size-4" />
	</Action>
	<span class="text-xs text-muted-foreground" role="status">
		{#if clipboard.status === 'failure'}Couldn't copy. Try selecting the response text.
		{:else if clipboard.copied}Copied
		{:else if feedback}Feedback selected locally{/if}
	</span>
</Actions>
