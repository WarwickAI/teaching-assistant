import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';
import { error } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { getLatestSession, lessonState } from '$lib/server/lesson';
import { parseStudentId, studentIdQuestion } from '$lib/student-id';
import type { RequestHandler } from './$types';

// A fixed reply in the same stream format as Claude's, saying whether the student is now signed in.
function reply(text: string, signedIn = false) {
	const stream = createUIMessageStream({
		execute: ({ writer }) => {
			writer.write({ type: 'start' });
			writer.write({ type: 'text-start', id: 'text' });
			writer.write({ type: 'text-delta', id: 'text', delta: text });
			writer.write({ type: 'text-end', id: 'text' });
			if (signedIn) writer.write({ type: 'data-signed-in', data: true });
			writer.write({ type: 'finish' });
		}
	});
	return createUIMessageStreamResponse({ stream });
}

// Forwards the student's newest message to Go and streams the reply back.
// Go keeps the conversation history, so earlier messages from the browser are ignored.
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (lessonState(await getLatestSession()) !== 'started') error(409, 'The lab is off.');
	const { messages }: { messages: UIMessage[] } = await request.json();
	const text = messages.at(-1)?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';
	const studentId = parseStudentId(cookies.get('student_id') ?? '');
	if (studentId) {
		const res = await api('/chat', { method: 'POST', body: JSON.stringify({ text }) }, studentId);
		return new Response(res.body, res);
	}

	// Until then, every message answers the student ID question.
	const id = parseStudentId(text);
	if (!id) return reply(`That doesn't look like a student ID. ${studentIdQuestion}`);
	cookies.set('student_id', id, { path: '/', httpOnly: true, sameSite: 'lax' });
	return reply('Thanks! What would you like help with?', true);
};
