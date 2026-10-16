<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { Button } from '$lib/components/ui/button';

	let { form }: { form: ActionData } = $props();
</script>

<main class="flex flex-1 flex-col items-center bg-stone-50 px-6 pt-16 pb-6 md:pb-14">
	<section class="my-auto w-full max-w-sm rounded-[26px] border bg-background p-5 shadow-[0_0_28px_2px_rgb(0_0_0/0.08)]">
		<form method="POST" use:enhance class="space-y-4">
			<div class="space-y-2">
				<label for="password" class="block text-sm text-muted-foreground">Instructor password</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input id="password" name="password" type="password" autocomplete="current-password" required autofocus aria-invalid={form?.wrongPassword ?? false} class="h-10 w-full rounded-xl border bg-white px-3 text-base outline-none focus-visible:border-stone-500 focus-visible:ring-2 focus-visible:ring-stone-200" />
				{#if form?.wrongPassword}<p role="alert" class="text-sm text-destructive">That password isn't right.</p>{/if}
				{#if form?.tooMany}<p role="alert" class="text-sm text-destructive">Too many attempts. Try again in 15 minutes.</p>{/if}
			</div>
			<Button type="submit" class="h-10 w-full rounded-full font-normal">Log in</Button>
		</form>
	</section>
	<a href="/" class="mt-6 text-sm text-muted-foreground hover:underline">Back to the lab</a>
</main>
