export interface Message {
	text: string;
}

export type ChatStatus = "submitted" | "streaming" | "error" | "ready";

export type PromptInputMessage = Message;
