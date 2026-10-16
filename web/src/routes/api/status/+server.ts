import { json } from '@sveltejs/kit';
import { getLatestSession, lessonState } from '$lib/server/lesson';
import { markOnline } from '$lib/server/presence';
import { getSettings } from '$lib/server/settings';
import { parseStudentId } from '$lib/student-id';
import type { RequestHandler } from './$types';

// What the student page checks every few seconds, so it only reloads its data when something it shows has changed.
// Each check also counts the student as online.
export const GET: RequestHandler = async ({ cookies }) => {
	const studentId = parseStudentId(cookies.get('student_id') ?? '');
	if (studentId) markOnline(studentId);
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
