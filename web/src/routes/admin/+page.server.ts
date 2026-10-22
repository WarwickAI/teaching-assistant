import { error, fail, redirect } from '@sveltejs/kit';
import { basename } from 'node:path';
import QRCode from 'qrcode';
import { api } from '$lib/server/api';
import { requireTeacher, signOutTeacher } from '$lib/server/auth';
import { loadDashboard } from '$lib/server/dashboard';
import { getLatestSession, lessonState, startLesson, endLesson, requestFeedback } from '$lib/server/lesson';
import type { Actions, PageServerLoad } from './$types';

async function listFiles(): Promise<string[]> {
	const res = await api('/context-files');
	if (!res.ok) throw new Error(`Go API returned ${res.status} for the context files`);
	return res.json();
}

async function check(res: Response, what: string) {
	if (!res.ok) error(502, `Couldn't ${what}`);
}

// Dummy data until the Go API keeps feedback, usage and attendance for past sessions.
const workshopDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const pastWorkshops = [
	{ id: 'w6', date: workshopDate('2026-10-14T13:02:00Z'), name: 'Evaluating model outputs', students: 24, spent: 3.86, tokens: 541200, feedback: [
		{ id: '2154321', rating: 5, text: 'The rubric exercise made it click, I finally get why a single score is not enough.' },
		{ id: '2160087', rating: 4, text: 'Good pace. Would have liked one more worked example before the group task.' },
		{ id: '2158812', rating: 4, text: '' },
		{ id: '2149930', rating: 3, text: 'Hard to follow the LLM-as-judge part, the slides went by quickly.' },
		{ id: '2157744', rating: 5, text: '' }
	] },
	{ id: 'w5', date: workshopDate('2026-10-07T13:04:00Z'), name: 'Agents and tool use', students: 27, spent: 5.12, tokens: 702850, feedback: [
		{ id: '2151120', rating: 5, text: 'Best session so far. Seeing the tool calls in the chat really helped.' },
		{ id: '2160087', rating: 4, text: '' },
		{ id: '2155509', rating: 2, text: 'My laptop struggled and I lost 20 minutes to setup.' },
		{ id: '2148876', rating: 4, text: 'More time on failure cases please, that was the most useful bit.' },
		{ id: '2159302', rating: 5, text: '' },
		{ id: '2153318', rating: 4, text: '' }
	] },
	{ id: 'w4', date: workshopDate('2026-09-30T13:01:00Z'), name: 'Retrieval and context', students: 22, spent: 2.94, tokens: 398400, feedback: [
		{ id: '2154321', rating: 4, text: 'Chunking explanation was clear. The assistant was helpful when I got stuck on embeddings.' },
		{ id: '2149930', rating: 3, text: '' },
		{ id: '2157744', rating: 5, text: 'Loved the comparison of context sizes, very practical.' },
		{ id: '2152267', rating: 3, text: 'Felt rushed at the end.' }
	] },
	{ id: 'w3', date: workshopDate('2026-09-23T13:06:00Z'), name: 'Structured outputs', students: 25, spent: 3.21, tokens: 447900, feedback: [
		{ id: '2160087', rating: 5, text: '' },
		{ id: '2158812', rating: 4, text: 'JSON schema part was great. Could we get the notebook earlier next time?' },
		{ id: '2151120', rating: 4, text: '' },
		{ id: '2155509', rating: 4, text: 'Clear and useful.' },
		{ id: '2148876', rating: 3, text: '' }
	] },
	{ id: 'w2', date: workshopDate('2026-09-16T13:03:00Z'), name: 'Prompting patterns', students: 29, spent: 4.07, tokens: 560100, feedback: [
		{ id: '2153318', rating: 5, text: 'Few-shot vs zero-shot comparison was eye opening.' },
		{ id: '2159302', rating: 4, text: '' },
		{ id: '2152267', rating: 4, text: 'Good, but the room was too warm to concentrate.' },
		{ id: '2149930', rating: 5, text: '' },
		{ id: '2157744', rating: 2, text: 'Too basic if you have used these tools before.' },
		{ id: '2154321', rating: 4, text: '' },
		{ id: '2160087', rating: 5, text: '' }
	] },
	{ id: 'w1', date: workshopDate('2026-09-09T13:08:00Z'), name: 'Introduction to LLMs', students: 31, spent: 2.38, tokens: 318700, feedback: [
		{ id: '2154321', rating: 4, text: 'Nice gentle start, the assistant answered my questions quickly.' },
		{ id: '2151120', rating: 3, text: 'Some of the terminology could use a glossary.' },
		{ id: '2148876', rating: 5, text: '' },
		{ id: '2158812', rating: 4, text: '' },
		{ id: '2155509', rating: 3, text: '' },
		{ id: '2152267', rating: 4, text: 'Would like the slides shared afterwards.' }
	] }
];

// The QR code for each address the site is served on, made once rather than on every reload.
const qrCodes = new Map<string, Promise<string>>();

export const load: PageServerLoad = async ({ cookies, url, setHeaders, parent }) => {
	requireTeacher(cookies);
	setHeaders({ 'cache-control': 'no-store' });
	const [{ lessonName, lessonResources }, files, session, dashboard] = await Promise.all([parent(), listFiles(), getLatestSession(), loadDashboard()]);
	const state = lessonState(session);
	if (!qrCodes.has(url.origin)) qrCodes.set(url.origin, QRCode.toDataURL(`${url.origin}/`, { width: 640, margin: 2 }));
	const qr = await qrCodes.get(url.origin)!;
	return {
		siteAddress: url.host,
		lessonState: state,
		feedbackRequested: state === 'started' && !!session?.feedbackRequestedAt,
		dashboard,
		qr,
		config: { lessonName, resources: lessonResources },
		files,
		pastWorkshops
	};
};

export const actions = {
	signout: ({ cookies }) => { requireTeacher(cookies); signOutTeacher(cookies); redirect(303, '/'); },
	start: async ({ cookies }) => { requireTeacher(cookies); if (lessonState(await getLatestSession()) !== 'started') await startLesson(); },
	end: async ({ cookies }) => { requireTeacher(cookies); if (lessonState(await getLatestSession()) === 'started') await endLesson(); },
	requestFeedback: async ({ cookies }) => { requireTeacher(cookies); await requestFeedback(); },
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
