import type { Snippet } from "svelte";
import type { UseClipboard } from "$lib/hooks/use-clipboard.svelte";
import type { WithChildren } from "bits-ui";

import type { ButtonProps, ButtonSize, ButtonVariant } from "$lib/components/ui/button/index.js";

export type ButtonPropsWithoutHTML = WithChildren<{
	ref?: HTMLElement | null;
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	onClickPromise?: (
		e: MouseEvent & {
			currentTarget: EventTarget & HTMLButtonElement;
		}
	) => Promise<void>;
}>;

export type CopyButtonPropsWithoutHTML = WithChildren<
	Pick<ButtonPropsWithoutHTML, "size" | "variant"> & {
		ref?: HTMLButtonElement | null;
		text: string;
		icon?: Snippet<[]>;
		animationDuration?: number;
		disbled?: boolean;
		onCopy?: (status: UseClipboard["status"]) => void;
	}
>;

export type CopyButtonProps = CopyButtonPropsWithoutHTML &
	Omit<ButtonProps, keyof CopyButtonPropsWithoutHTML | "href" | "type">;
