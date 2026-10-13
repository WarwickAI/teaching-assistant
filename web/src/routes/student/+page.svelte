<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Chat } from '@ai-sdk/svelte';
	import type { PageData } from './$types';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Presentation from '@lucide/svelte/icons/presentation';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Link from '@lucide/svelte/icons/link';
	import Star from '@lucide/svelte/icons/star';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Message from '$lib/components/ai-elements/message';
	import * as PromptInput from '$lib/components/ai-elements/prompt-input';
	import * as Plan from '$lib/components/ai-elements/plan';
	import { Shimmer } from '$lib/components/ai-elements/shimmer';
	import { UseTypewriter } from '$lib/hooks/use-typewriter.svelte';

	let { data }: { data: PageData } = $props();
	const resourceIcons = { slides: Presentation, notebook: NotebookPen, link: Link };
	let draft = $state('');
	// Seeded once from the saved conversation; afterwards Chat owns the messages.
	const chat = new Chat({ messages: untrack(() => data.messages) });
	let lessonEnded = $derived(data.lessonState === 'ended');

	// Follow new text as it streams in, unless the student has scrolled up to read.
	let pinned = true;
	const updatePinned = () => (pinned = innerHeight + scrollY >= document.documentElement.scrollHeight - 80);
	function followBottom(node: HTMLElement) {
		const observer = new ResizeObserver(() => pinned && scrollTo({ top: document.documentElement.scrollHeight }));
		observer.observe(node);
		return () => observer.disconnect();
	}
	let feedbackOpen = $state(false);
	let feedbackContent = $state<HTMLDivElement | null>(null);
	let rating = $state(0);
	let comments = $state('');
	let feedbackSubmitted = $state(false);

	$effect(() => {
		if (lessonEnded) return;
		const timer = setInterval(invalidateAll, 5000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		if (lessonEnded && !feedbackSubmitted) feedbackOpen = true;
	});

	const prompts = [
		'What was overfitting again?',
		'How do I calculate MSE?',
		"Explain what loss is and why it's important."
	];
	let promptIndex = -1;
	const promptPlaceholder = new UseTypewriter(() => prompts[(promptIndex = (promptIndex + 1) % prompts.length)]);
</script>

<svelte:window onscroll={updatePinned} />

<Dialog.Root bind:open={feedbackOpen}>
	<Dialog.Content
		bind:ref={feedbackContent}
		class="gap-6 rounded-[26px] p-5 shadow-2xl sm:p-6"
		showCloseButton={false}
		onOpenAutoFocus={(event) => { event.preventDefault(); feedbackContent?.focus(); }}
	>
		<Dialog.Header class="gap-2">
			<Dialog.Title class="text-xl font-medium">How was the workshop?</Dialog.Title>
			<Dialog.Description class="leading-relaxed">Every time we run an event, the first thing we look at is your feedback. Even a couple words really, really help!</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/feedback" class="contents" use:enhance={() => { feedbackSubmitted = true; feedbackOpen = false; }}>
		<fieldset class="space-y-1.5">
			<legend class="text-sm font-medium">Your rating</legend>
			<div class="flex justify-center gap-2">
				{#each [1, 2, 3, 4, 5] as value}
					<label class="cursor-pointer">
						<input type="radio" name="rating" {value} bind:group={rating} class="peer sr-only" aria-label={`${value} out of 5 stars`} />
						<span class="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
							<Star class={`size-7 ${value <= rating ? 'fill-foreground text-foreground' : 'text-muted-foreground/40'}`} strokeWidth={1.5} aria-hidden="true" />
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
		<div class="space-y-1.5">
			<label for="feedback-comments" class="block text-sm font-medium">Anything to add?</label>
			<Textarea id="feedback-comments" name="comment" bind:value={comments} rows={4} class="min-h-28 resize-y rounded-xl p-4 text-base md:text-sm" placeholder="What worked well? What could we improve?" />
		</div>
		<div class="space-y-3">
			<Button type="submit" class="w-full rounded-full" size="lg" disabled={!rating}>Done</Button>
		</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<form id="signout-form" method="POST" action="?/signout" use:enhance hidden></form>

<main class="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-4 pt-4 md:px-6 md:pt-20">
	<div class="flex flex-1 flex-col gap-6" aria-live="polite" {@attach followBottom}>
		<Message.Root from="assistant">
			<Plan.Root open>
				<Plan.Header>
					<div>
						<Plan.Title>{#snippet children()}{data.lessonName ? `Welcome to ${data.lessonName}` : 'Welcome'}{/snippet}</Plan.Title>
						<Plan.Description class="mt-0.5">{#snippet children()}Workshop resources are at the top, and anything we don't use is recommended reading.{/snippet}</Plan.Description>
					</div>
					{#if data.resources.length}
						<Plan.Action><Plan.Trigger /></Plan.Action>
					{/if}
				</Plan.Header>
				{#if data.resources.length}
					<Plan.Content>
						<ul class="space-y-2">
							{#each data.resources as resource (resource.url)}
								{@const Icon = resourceIcons[resource.kind]}
								<li>
									<a href={resource.url} target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-sm hover:underline">
										<Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
										{resource.title}
									</a>
								</li>
							{/each}
						</ul>
					</Plan.Content>
				{/if}
			</Plan.Root>
		</Message.Root>
		{#each chat.messages as message (message.id)}
			<Message.Root from={message.role}>
				<Message.Content class="text-base md:text-sm">
					{@const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')}
					{#if message.role === 'assistant'}<Message.Response content={text} />{:else}<p class="whitespace-pre-wrap wrap-break-words">{text}</p>{/if}
					{@const status = message.parts.find((part) => part.type === 'data-status')}
					{#if status && 'data' in status && status.data}<Shimmer class="text-sm">{#snippet children()}{status.data}{/snippet}</Shimmer>{/if}
				</Message.Content>
			</Message.Root>
		{/each}
		{#if chat.error}<p role="alert" class="text-sm text-muted-foreground">{chat.error.message}</p>{/if}
	</div>

	<div class="sticky bottom-0 z-20 pb-4 md:pb-[40px]">
		<div class="absolute inset-x-0 top-1/2 bottom-0 md:top-[calc((100%-40px)/2)] bg-background" aria-hidden="true"></div>
		{#if data.lessonState === 'waiting'}
			<div class="relative rounded-[26px] p-5 text-center border md:border-0 md:shadow-[0_0_28px_2px_rgb(0_0_0/0.08)]" role="status">
				<p class="text-sm">Your teacher hasn't started the lesson yet.</p>
			</div>
		{:else if lessonEnded}
			<div class="relative flex flex-col items-center gap-3 rounded-[26px] bg-background p-5 text-center border md:border-0 md:shadow-[0_0_28px_2px_rgb(0_0_0/0.08)]" role="status">
				{#if feedbackSubmitted}
					<p class="text-sm">Thank you for participating!</p>
				{:else}
					<p class="text-sm">The lesson has ended.</p>
					<Button variant="secondary" class="gap-2 rounded-full px-3 font-normal" onclick={() => { feedbackOpen = true; }}>
						<MessageSquare class="size-4" aria-hidden="true" />
						Give feedback
					</Button>
				{/if}
			</div>
		{:else}
		<PromptInput.Root
			class="relative rounded-[26px] border-0 ring-1 ring-foreground/10 md:shadow-[0_0_28px_2px_rgb(0_0_0/0.08)]"
			onSubmit={({ text }) => { pinned = true; void chat.sendMessage({ text }); }}
		>
			<PromptInput.Body>
				<PromptInput.Textarea class="px-4 pt-3 pb-1.5 text-base md:px-5 md:pt-4 md:text-sm" bind:value={draft} placeholder={promptPlaceholder.text} />
			</PromptInput.Body>
			<PromptInput.Toolbar class="justify-between px-2 pt-0 pb-2">
				<div class="ml-auto flex shrink-0 items-center gap-2">
					<Button variant="secondary" type="submit" form="signout-form" class="gap-2 rounded-full px-3 font-normal">
						<LogOut class="size-4" aria-hidden="true" />
						Sign out
					</Button>
					<Button variant="secondary" class="gap-2 rounded-full px-3 font-normal" onclick={() => { feedbackOpen = true; }}>
						<MessageSquare class="size-4" aria-hidden="true" />
						Give feedback
					</Button>
					<PromptInput.Submit data-prompt-input-submit class="grid place-items-center gap-0 rounded-full p-0" status={chat.status} onStop={() => chat.stop()} disabled={chat.status === 'ready' && !draft.trim()} />
				</div>
			</PromptInput.Toolbar>
		</PromptInput.Root>
		{/if}
	</div>
</main>
