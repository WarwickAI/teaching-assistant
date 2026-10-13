import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, parseDocument } from 'yaml';

const configPath = resolve('../config.yaml');
export const contextDir = resolve('../context');

export type Config = {
	secret_word?: string;
	lesson_name?: string;
	spending_cap_usd?: number;
	resources?: { title: string; url: string }[];
};

// Read on every use, so edits from the dashboard apply straight away.
export const readConfig = (): Config => parse(readFileSync(configPath, 'utf8')) ?? {};

// Updates config.yaml in place, keeping its comments.
export function updateConfig(values: Config) {
	const doc = parseDocument(readFileSync(configPath, 'utf8'));
	for (const [key, value] of Object.entries(values)) doc.set(key, value);
	writeFileSync(configPath, doc.toString());
}
