import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import QRCode from 'qrcode';
import { api } from '$lib/server/api';
import { requireTeacher, signOutTeacher } from '$lib/server/auth';
import { contextDir, readConfig, updateConfig } from '$lib/server/config';
import { endLesson, getLessonState, startLesson } from '$lib/server/lesson';
import type { Actions, PageServerLoad } from './$types';

type Dashboard = {
	attendance: { startedAt: string; students: number }[];
	students: { studentId: string; sessionsAttended: number; messages: { role: 'user' | 'assistant'; content: string }[] }[];
	feedback: { studentId: string; rating: number; comment: string | null; createdAt: string }[];
	struggles: { studentId: string; topic: string; details: string; createdAt: string }[];
	spending: { at: string; usd: number }[];
	tokensUsed: number;
	spentUsd: number;
	spendingCapUsd: number;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

async function loadDashboard() {
	const res = await api('/dashboard');
	if (!res.ok) throw new Error(`Go API returned ${res.status} for the dashboard`);
	const d: Dashboard = await res.json();
	return {
		attendance: d.attendance.map((s) => ({ label: new Date(s.startedAt).toLocaleDateString('en-GB'), count: s.students })),
		students: d.students.map((s) => ({
			label: s.studentId,
			count: s.sessionsAttended,
			messages: s.messages.map((m) => ({ role: m.role, text: m.content }))
		})),
		feedback: d.feedback.map((f) => ({ id: f.studentId, rating: f.rating, text: f.comment ?? '', time: time(f.createdAt) })),
		struggles: d.struggles.map((s) => ({ id: s.studentId, topic: s.topic, text: s.details, time: time(s.createdAt) })),
		spending: d.spending.map((p) => ({ time: time(p.at), amount: p.usd })),
		usage: { tokensUsed: d.tokensUsed, spendingCap: d.spendingCapUsd },
		spent: d.spentUsd
	};
}

export const load: PageServerLoad = async ({ cookies, url, setHeaders }) => {
	requireTeacher(cookies);
	setHeaders({ 'cache-control': 'no-store' });
	const config = readConfig();
	const sessionUrl = new URL('/', env.TUNNEL_URL || url.origin).href; // the public tunnel, when running
	const [entries, lessonState, dashboard, qr] = await Promise.all([
		readdir(contextDir, { withFileTypes: true }),
		getLessonState(),
		loadDashboard(),
		QRCode.toDataURL(sessionUrl, { width: 640, margin: 2 })
	]);
	return {
		sessionUrl,
		lessonState,
		dashboard,
		qr,
		config: { lessonName: config.lesson_name ?? '', resources: config.resources ?? [] },
		files: entries.filter((file) => file.isFile() && /\.md$/i.test(file.name)).map((file) => file.name).sort()
	};
};

export const actions = {
	signout: ({ cookies }) => { requireTeacher(cookies); signOutTeacher(cookies); redirect(303, '/'); },
	start: async ({ cookies }) => { requireTeacher(cookies); if (await getLessonState() === 'waiting') await startLesson(); },
	end: async ({ cookies }) => { requireTeacher(cookies); if (await getLessonState() === 'started') await endLesson(); },
	settings: async ({ cookies, request }) => {
		requireTeacher(cookies);
		const form = await request.formData();
		const { lessonName, resources, spendingCap } = JSON.parse(String(form.get('settings')));
		if (typeof lessonName !== 'string' || !Array.isArray(resources) || typeof spendingCap !== 'number' || spendingCap < 0) return fail(400);
		updateConfig({
			lesson_name: lessonName.trim(),
			spending_cap_usd: spendingCap,
			resources: resources
				.filter(({ title, url }) => typeof title === 'string' && title.trim() && URL.canParse(url))
				.map(({ title, url }) => ({ title: title.trim(), url }))
		});
		for (const file of form.getAll('files')) {
			if (file instanceof File && /\.md$/i.test(file.name)) {
				await writeFile(join(contextDir, basename(file.name)), new Uint8Array(await file.arrayBuffer()));
			}
		}
	},
	shutdown: async ({ cookies }) => {
		requireTeacher(cookies);
		if (await getLessonState() !== 'ended') return;
		setTimeout(() => process.exit(0), 100);
	}
} satisfies Actions;
