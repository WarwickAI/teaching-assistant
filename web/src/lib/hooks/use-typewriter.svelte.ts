import { untrack } from "svelte";

type Options = {
	/** Milliseconds per typed character. */
	typeDelay: number;
	/** Milliseconds per deleted character. */
	deleteDelay: number;
	/** Milliseconds to hold the finished text before deleting it. */
	holdDelay: number;
};

/** Types out a string, deletes it, then types the next one from `next`, forever.
 *
 * Must be created during component initialisation. With reduced motion, the first string is shown statically.
 *
 * ## Usage
 * ```svelte
 * <script lang="ts">
 * 		import { UseTypewriter } from "$lib/hooks/use-typewriter.svelte";
 *
 * 		const typewriter = new UseTypewriter(() => "Hello, World!");
 * </script>
 *
 * <input placeholder={typewriter.text} />
 * ```
 */
export class UseTypewriter {
	#text = $state("");

	constructor(next: () => string, { typeDelay = 70, deleteDelay = 35, holdDelay = 3000 }: Partial<Options> = {}) {
		$effect(() => untrack(() => {
			let target = next();

			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				this.#text = target;
				return;
			}

			let deleting = false;
			let timeout: ReturnType<typeof setTimeout>;

			const tick = () => {
				if (!deleting && this.#text === target) {
					deleting = true;
					timeout = setTimeout(tick, holdDelay);
					return;
				}
				if (deleting && this.#text === "") {
					deleting = false;
					target = next();
				}
				this.#text = deleting ? this.#text.slice(0, -1) : target.slice(0, this.#text.length + 1);
				timeout = setTimeout(tick, deleting ? deleteDelay : typeDelay);
			};

			tick();
			return () => clearTimeout(timeout);
		}));
	}

	/** The currently visible text. */
	get text() {
		return this.#text;
	}
}
