import { error, fail, redirect } from '@sveltejs/kit';
import { basename } from 'node:path';
import QRCode from 'qrcode';
import { api } from '$lib/server/api';
import { requireTeacher, signOutTeacher } from '$lib/server/auth';
import { loadDashboard } from '$lib/server/dashboard';
import { getLatestSession, lessonState, startLesson, endLesson } from '$lib/server/lesson';
import { getSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

async function listFiles(): Promise<string[]> {
	const res = await api('/context-files');
	if (!res.ok) throw new Error(`Go API returned ${res.status} for the context files`);
	return res.json();
}

async function check(res: Response, what: string) {
	if (!res.ok) error(502, `Couldn't ${what}`);
}

export const load: PageServerLoad = async ({ cookies, url, setHeaders }) => {
	requireTeacher(cookies);
	setHeaders({ 'cache-control': 'no-store' });
	const [settings, files, session, dashboard] = await Promise.all([getSettings(), listFiles(), getLatestSession(), loadDashboard()]);
	const state = lessonState(session);
	const qr = await QRCode.toDataURL(`${url.origin}/`, { width: 640, margin: 2 });
	return {
		siteAddress: url.host,
		lessonState: state,
		dashboard,
		qr,
		config: { lessonName: settings.lessonName, resources: settings.resources },
		files
	};
};

export const actions = {
	signout: ({ cookies }) => { requireTeacher(cookies); signOutTeacher(cookies); redirect(303, '/'); },
	start: async ({ cookies }) => { requireTeacher(cookies); if (lessonState(await getLatestSession()) !== 'started') await startLesson(); },
	end: async ({ cookies }) => { requireTeacher(cookies); if (lessonState(await getLatestSession()) === 'started') await endLesson(); },
	settings: async ({ cookies, request }) => {
		requireTeacher(cookies);
		const form = await request.formData();
		const { lessonName, resources, spendingCap } = JSON.parse(String(form.get('settings')));
		if (typeof lessonName !== 'string' || !Array.isArray(resources) || typeof spendingCap !== 'number' || spendingCap < 0) return fail(400);
		await check(await api('/settings', {
			method: 'PUT',
			body: JSON.stringify({
				lessonName: lessonName.trim(),
				spendingCapUsd: spendingCap,
				resources: resources
					.filter(({ title, url }) => typeof title === 'string' && title.trim() && URL.canParse(url))
					.map(({ title, url }) => ({ title: title.trim(), url }))
			})
		}), 'save the settings');
		// Removals go first, so a file can be removed and uploaded again in one save.
		for (const name of form.getAll('remove')) {
			await check(await api(`/context-files/${encodeURIComponent(String(name))}`, { method: 'DELETE' }), `remove ${name}`);
		}
		for (const file of form.getAll('files')) {
			if (file instanceof File && /\.md$/i.test(file.name)) {
				const name = basename(file.name);
				await check(await api(`/context-files/${encodeURIComponent(name)}`, { method: 'PUT', body: await file.text() }), `upload ${name}`);
			}
		}
	}
} satisfies Actions;
