import { requireTeacher } from '$lib/server/auth';
import { loadDashboard } from '$lib/server/dashboard';
import type { RequestHandler } from './$types';

// Sends the dashboard's feedback and spending as server-sent events, every 3 seconds while the teacher has it open.
export const GET: RequestHandler = ({ cookies }) => {
	requireTeacher(cookies);
	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setInterval>;
	const stream = new ReadableStream({
		start(controller) {
			const send = async () => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(await loadDashboard())}\n\n`));
				} catch (err) {
					console.error('dashboard stream', err); // the browser reconnects if the stream closes
				}
			};
			void send();
			timer = setInterval(send, 3000);
		},
		cancel: () => clearInterval(timer)
	});
	return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } });
};
