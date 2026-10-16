import { api } from './api';
import { onlineCount } from './presence';

type Dashboard = {
	feedback: { studentId: string; rating: number; comment: string | null; createdAt: string }[];
	struggles: { studentId: string; topic: string; details: string; createdAt: string }[];
	spending: { at: string; usd: number }[];
	tokensUsed: number;
	spentUsd: number;
	spendingCapUsd: number;
	attendance: { startedAt: string; endedAt: string | null; students: number }[];
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function loadDashboard() {
	const res = await api('/dashboard');
	if (!res.ok) throw new Error(`Go API returned ${res.status} for the dashboard`);
	const d: Dashboard = await res.json();
	return {
		feedback: d.feedback.map((f) => ({ id: f.studentId, rating: f.rating, text: f.comment ?? '', time: time(f.createdAt) })),
		struggles: d.struggles.map((s) => ({ id: s.studentId, topic: s.topic, text: s.details, time: time(s.createdAt) })),
		spending: d.spending.map((p) => ({ time: time(p.at), amount: p.usd })),
		usage: { tokensUsed: d.tokensUsed, spendingCap: d.spendingCapUsd },
		spent: d.spentUsd,
		online: onlineCount(),
		attendance: d.attendance.map((a) => ({ id: a.startedAt, date: date(a.startedAt), students: a.students, current: !a.endedAt }))
	};
}
