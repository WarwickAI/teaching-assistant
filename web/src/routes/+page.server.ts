import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { secretMatches, signInTeacher } from '$lib/server/auth';

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const value = data.get('student_id');
		const studentId = typeof value === 'string' ? value.trim() : '';
		if (secretMatches(studentId)) {
			signInTeacher(cookies);
			redirect(303, '/teacher');
		}

		if (!/^[0-9]+$/.test(studentId)) {
			return fail(400, { invalid: true, studentId: '' });
		}

		cookies.set('student_id', studentId, { path: '/', httpOnly: true, sameSite: 'lax' });
		redirect(303, resolve('/student'));
	}
} satisfies Actions;
