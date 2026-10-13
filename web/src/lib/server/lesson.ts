import type { UIMessage } from 'ai';
import { api } from './api';

export type LessonState = 'waiting' | 'started' | 'ended';

// Go decides whether a lesson is open; this only remembers that one ended while this process ran.
let ended = false;
const closedState = (): LessonState => (ended ? 'ended' : 'waiting');

async function check(res: Response, what: string) {
	if (!res.ok && res.status !== 404 && res.status !== 409) throw new Error(`Go API returned ${res.status} ${what}`);
	return res;
}

export async function getLessonState(): Promise<LessonState> {
	const res = await check(await api('/sessions/current'), 'for the current session');
	return res.ok ? 'started' : closedState();
}

export async function startLesson() {
	await check(await api('/sessions', { method: 'POST' }), 'starting the lesson');
}

export async function endLesson() {
	await check(await api('/sessions/current/end', { method: 'POST' }), 'ending the lesson');
	ended = true;
}

// Records the student's attendance and returns their conversation, if a lesson is open.
export async function joinLesson(studentId: string): Promise<{ lessonState: LessonState; messages: UIMessage[] }> {
	const res = await check(await api('/join', { method: 'POST' }, studentId), 'joining the lesson');
	if (!res.ok) return { lessonState: closedState(), messages: [] };
	const rows: { id: number; role: 'user' | 'assistant'; content: string }[] = await res.json();
	return {
		lessonState: 'started',
		messages: rows.map((m) => ({ id: String(m.id), role: m.role, parts: [{ type: 'text', text: m.content }] }))
	};
}
