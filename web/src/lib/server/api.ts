import { env } from '$env/dynamic/private';

// Calls the Go backend over the private network.
export function api(path: string, init: RequestInit = {}, studentId?: string) {
	const headers = new Headers(init.headers);
	if (studentId) headers.set('X-Student-ID', studentId);
	return fetch(new URL(path, env.GO_API_URL || 'http://127.0.0.1:8080'), { ...init, headers });
}
