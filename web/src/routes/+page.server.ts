import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import type { UIMessage } from 'ai';
import { api } from '$lib/server/api';
import { getLatestSession, lessonState, loadConversation } from '$lib/server/lesson';
import { markOffline, markOnline } from '$lib/server/presence';
import { parseStudentId } from '$lib/student-id';
import type { Actions, PageServerLoad } from './$types';

type ResourceKind = 'slides' | 'notebook' | 'link';

function resourceKind(url: URL): ResourceKind {
	if (url.hostname === 'docs.google.com' && url.pathname.startsWith('/presentation/')) return 'slides';
	if (url.hostname === 'molab.marimo.io') return 'slides';
	if (url.hostname === 'colab.research.google.com') return 'notebook';
	return 'link';
}

export const load: PageServerLoad = async ({ cookies, parent }) => {
	const [session, { lessonResources }] = await Promise.all([getLatestSession(), parent()]);
	const state = lessonState(session);
	const studentId = parseStudentId(cookies.get('student_id') ?? '');
	const resources = lessonResources.flatMap(({ title, url }) =>
		URL.canParse(url) ? [{ title: title.trim(), url, kind: resourceKind(new URL(url)) }] : []
	);
	if (studentId && state === 'started') markOnline(studentId);
	// Until the student signs in, there's no conversation to load.
	const messages: UIMessage[] = studentId && state === 'started' ? await loadConversation(studentId) : [];
	return { studentId, resources, lessonState: state, messages, feedbackRequestedAt: session?.feedbackRequestedAt ?? null };
};

export const actions = {
	signout: ({ cookies }) => {
		const studentId = parseStudentId(cookies.get('student_id') ?? '');
		if (studentId) markOffline(studentId);
		cookies.delete('student_id', { path: '/' });
		redirect(303, resolve('/'));
	},
	signin: async ({ cookies, request }) => {
		const studentId = parseStudentId(String((await request.formData()).get('student_id') ?? ''));
		if (!studentId) return fail(400, { invalidStudentId: true });
		cookies.set('student_id', studentId, { path: '/', httpOnly: true, sameSite: 'lax' });
		redirect(303, resolve('/'));
	},
	feedback: async ({ cookies, request }) => {
		const studentId = parseStudentId(cookies.get('student_id') ?? '');
		if (!studentId) return fail(401);
		const form = await request.formData();
		const rating = Number(form.get('rating'));
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400);
		const res = await api('/feedback', { method: 'POST', body: JSON.stringify({ rating, comment: form.get('comment') ?? '' }) }, studentId);
		if (!res.ok) return fail(res.status);
	}
} satisfies Actions;
