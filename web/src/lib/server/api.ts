import { env } from '$env/dynamic/private';

// Calls the Go backend, which only accepts requests carrying the shared token.
export function api(path: string, init: RequestInit = {}, studentId?: string) {
	if (!env.INTERNAL_TOKEN) throw new Error('INTERNAL_TOKEN is not set');
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${env.INTERNAL_TOKEN}`);
	if (studentId) headers.set('X-Student-ID', studentId);
	return fetch(new URL(path, env.GO_API_URL || 'http://127.0.0.1:8080'), { ...init, headers });
}
