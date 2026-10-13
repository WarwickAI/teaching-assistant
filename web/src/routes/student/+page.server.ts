import { resolve } from '$app/paths';
import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { readConfig } from '$lib/server/config';
import { joinLesson } from '$lib/server/lesson';
import type { Actions, PageServerLoad } from './$types';

type ResourceKind = 'slides' | 'notebook' | 'link';

function resourceKind(url: URL): ResourceKind {
	if (url.hostname === 'docs.google.com' && url.pathname.startsWith('/presentation/')) return 'slides';
	if (url.hostname === 'molab.marimo.io') return 'slides';
	if (url.hostname === 'colab.research.google.com') return 'notebook';
	return 'link';
}

function requireStudent(cookies: Cookies) {
	const studentId = cookies.get('student_id') ?? '';
	if (!/^[0-9]+$/.test(studentId)) redirect(303, resolve('/'));
	return studentId;
}

export const load: PageServerLoad = async ({ cookies }) => {
	const studentId = requireStudent(cookies);
	const resources = (readConfig().resources ?? []).flatMap(({ title, url }) =>
		typeof title === 'string' && URL.canParse(url) ? [{ title: title.trim(), url, kind: resourceKind(new URL(url)) }] : []
	);
	return { studentId, resources, ...(await joinLesson(studentId)) };
};

export const actions = {
	signout: ({ cookies }) => {
		cookies.delete('student_id', { path: '/' });
		redirect(303, resolve('/'));
	},
	feedback: async ({ cookies, request }) => {
		const studentId = requireStudent(cookies);
		const form = await request.formData();
		const rating = Number(form.get('rating'));
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400);
		const res = await api('/feedback', { method: 'POST', body: JSON.stringify({ rating, comment: form.get('comment') ?? '' }) }, studentId);
		if (!res.ok) return fail(res.status);
	}
} satisfies Actions;
