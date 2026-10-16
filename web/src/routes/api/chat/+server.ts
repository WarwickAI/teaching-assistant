import type { UIMessage } from 'ai';
import { error } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { getLatestSession, lessonState } from '$lib/server/lesson';
import { parseStudentId } from '$lib/student-id';
import type { RequestHandler } from './$types';

// Forwards the student's newest message to Go and streams the reply back.
// Go keeps the conversation history, so earlier messages from the browser are ignored.
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (lessonState(await getLatestSession()) !== 'started') error(409, 'The lab is off.');
	const studentId = parseStudentId(cookies.get('student_id') ?? '');
	if (!studentId) error(401, 'Sign in with your student ID first.');
	const { messages }: { messages: UIMessage[] } = await request.json();
	const text = messages.at(-1)?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';
	const res = await api('/chat', { method: 'POST', body: JSON.stringify({ text }) }, studentId);
	return new Response(res.body, res);
};
