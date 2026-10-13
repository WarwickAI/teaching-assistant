<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import logo from '$lib/assets/warwick-ai-logo.svg';
	import { GlyphMatrix } from '$lib/components/magic/glyph-matrix';
	import { Button } from '$lib/components/ui/button';
	import { UseTypewriter } from '$lib/hooks/use-typewriter.svelte';

	let { form }: { form: ActionData } = $props();
	let invalid = $derived(form?.invalid ?? false);
	const idPlaceholder = new UseTypewriter(() => String(5_000_000 + Math.floor(Math.random() * 2_000_000)));
</script>

<main class="relative isolate grid flex-1 place-items-center overflow-hidden bg-stone-50 px-6 py-16">
	<div class="matrix pointer-events-none absolute inset-0 -z-10 opacity-30" aria-hidden="true">
		<GlyphMatrix glyphs={'WAI  '} cellSize={18} color="#78716c" boost={1} interval={180} mutationRate={0.015} />
	</div>

	<section class="w-full max-w-sm rounded-[26px] border bg-background p-5 shadow-[0_0_28px_2px_rgb(0_0_0/0.08)]">
		<form method="POST" use:enhance class="space-y-4">
			<div class="space-y-2">
				<label for="student-id" class="block font-sans text-sm text-muted-foreground">Student ID</label>
				<input
					id="student-id"
					name="student_id"
					value={form?.studentId ?? ''}
					oninput={() => { invalid = false; }}
					autocomplete="username"
					autocapitalize="none"
					spellcheck={false}
					required
					placeholder={idPlaceholder.text}
					class:text-destructive={invalid}
					class="h-10 w-full rounded-xl border bg-white px-3 text-base outline-none focus-visible:border-stone-500 focus-visible:ring-2 focus-visible:ring-stone-200"
				/>
			</div>
			<Button type="submit" class="h-10 w-full rounded-full font-normal">
				Continue to <img src={logo} alt="WAI" class="h-[9.5px] w-auto brightness-0 invert" /> workshop
			</Button>
		</form>
	</section>
</main>

<style>
	@media (prefers-reduced-motion: reduce) {
		.matrix {
			display: none;
		}
	}
</style>
