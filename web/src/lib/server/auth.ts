import { randomBytes, timingSafeEqual } from 'node:crypto';
import { redirect, type Cookies } from '@sveltejs/kit';
import { readConfig } from './config';

const sessions = new Map<string, number>();
export function secretMatches(value: string) {
	const secret = readConfig().secret_word;
	if (typeof secret !== 'string' || !secret) return false;
	const actual = Buffer.from(value);
	const expected = Buffer.from(secret);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function signInTeacher(cookies: Cookies) {
	for (const [token, expires] of sessions) if (expires < Date.now()) sessions.delete(token);
	const token = randomBytes(32).toString('hex');
	sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
	cookies.set('teacher_session', token, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 43200 });
	cookies.delete('student_id', { path: '/' });
}
export function requireTeacher(cookies: Cookies) {
	const token = cookies.get('teacher_session') ?? '';
	if ((sessions.get(token) ?? 0) <= Date.now()) redirect(303, '/');
}
export function signOutTeacher(cookies: Cookies) {
	sessions.delete(cookies.get('teacher_session') ?? '');
	cookies.delete('teacher_session', { path: '/' });
}
