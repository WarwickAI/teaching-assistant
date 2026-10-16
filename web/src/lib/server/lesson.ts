import type { UIMessage } from 'ai';
import { api } from './api';

export type LessonState = 'waiting' | 'started' | 'ended';
type Session = { startedAt: string; endedAt: string | null; feedbackRequestedAt: string | null };

async function check(res: Response, what: string) {
	if (!res.ok && res.status !== 404 && res.status !== 409) throw new Error(`Go API returned ${res.status} ${what}`);
	return res;
}

// The open lesson, or the last one if it has ended.
export async function getLatestSession(): Promise<Session | null> {
	const res = await check(await api('/sessions/latest'), 'for the latest session');
	return res.ok ? res.json() : null;
}

export const lessonState = (session: Session | null): LessonState =>
	!session ? 'waiting' : session.endedAt ? 'ended' : 'started';

export async function startLesson() {
	await check(await api('/sessions', { method: 'POST' }), 'starting the lesson');
}

export async function endLesson() {
	await check(await api('/sessions/current/end', { method: 'POST' }), 'ending the lesson');
}

export async function requestFeedback() {
	await check(await api('/sessions/current/request-feedback', { method: 'POST' }), 'asking for feedback');
}

// The student's conversation in the open lesson, if there is one.
export async function loadConversation(studentId: string): Promise<UIMessage[]> {
	const res = await check(await api('/join', { method: 'POST' }, studentId), 'joining the lesson');
	if (!res.ok) return [];
	const rows: { id: number; role: 'user' | 'assistant'; content: string }[] = await res.json();
	return rows.map((m) => ({ id: String(m.id), role: m.role, parts: [{ type: 'text', text: m.content }] }));
}
