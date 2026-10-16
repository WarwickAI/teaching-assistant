import { api } from './api';

export type Settings = {
	lessonName: string;
	spendingCapUsd: number;
	resources: { title: string; url: string }[];
};

// Go stores the settings, so edits from the dashboard apply straight away.
export async function getSettings(): Promise<Settings> {
	const res = await api('/settings');
	if (!res.ok) throw new Error(`Go API returned ${res.status} for the settings`);
	return res.json();
}
