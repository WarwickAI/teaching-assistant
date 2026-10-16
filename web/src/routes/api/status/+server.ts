import { json } from '@sveltejs/kit';
import { getLatestSession, lessonState } from '$lib/server/lesson';
import { getSettings } from '$lib/server/settings';
import type { RequestHandler } from './$types';

// What the student page checks every few seconds, so it only reloads its data when something it shows has changed.
export const GET: RequestHandler = async () => {
	const [session, { lessonName, resources }] = await Promise.all([getLatestSession(), getSettings()]);
	return json(
		{
			lessonState: lessonState(session),
			feedbackRequestedAt: session?.feedbackRequestedAt ?? null,
			lessonName: lessonName.trim(),
			lessonResources: resources
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
