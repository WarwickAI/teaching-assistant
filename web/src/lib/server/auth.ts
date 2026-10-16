import { createHmac, timingSafeEqual } from 'node:crypto';
import { redirect, type Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const sameText = (a: string, b: string) => {
	const actual = Buffer.from(a);
	const expected = Buffer.from(b);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const passwordMatches = (value: string) => !!env.INSTRUCTOR_PASSWORD && sameText(value, env.INSTRUCTOR_PASSWORD);

// Instructor sessions are signed rather than stored, so they survive the app sleeping and restarting.
const sign = (expires: string) => createHmac('sha256', env.INSTRUCTOR_PASSWORD ?? '').update(expires).digest('hex');

export function signInTeacher(cookies: Cookies) {
	const expires = String(Date.now() + 12 * 60 * 60 * 1000);
	cookies.set('teacher_session', `${expires}.${sign(expires)}`, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 43200 });
	cookies.delete('student_id', { path: '/' });
}
export function requireTeacher(cookies: Cookies) {
	const [expires = '', signature = ''] = (cookies.get('teacher_session') ?? '').split('.');
	if (!env.INSTRUCTOR_PASSWORD || Number(expires) <= Date.now() || !sameText(signature, sign(expires))) redirect(303, '/login');
}
export function signOutTeacher(cookies: Cookies) {
	cookies.delete('teacher_session', { path: '/' });
}
