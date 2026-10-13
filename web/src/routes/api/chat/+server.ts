import { error } from '@sveltejs/kit';
import type { UIMessage } from 'ai';
import { api } from '$lib/server/api';
import type { RequestHandler } from './$types';

// Forwards the student's newest message to Go and streams the reply back.
// Go keeps the conversation history, so earlier messages from the browser are ignored.
export const POST: RequestHandler = async ({ request, cookies }) => {
	const studentId = cookies.get('student_id') ?? '';
	if (!/^[0-9]+$/.test(studentId)) error(401);
	const { messages }: { messages: UIMessage[] } = await request.json();
	const text = messages.at(-1)?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';
	const res = await api('/chat', { method: 'POST', body: JSON.stringify({ text }) }, studentId);
	return new Response(res.body, res);
};
