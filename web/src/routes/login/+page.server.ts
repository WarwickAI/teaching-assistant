import { fail, redirect } from '@sveltejs/kit';
import { passwordMatches, signInTeacher } from '$lib/server/auth';
import { failureLimit } from '$lib/server/rate-limit';
import type { Actions } from './$types';

// The instructor shares the campus IP address with the class, so this mustn't lock them out for long.
const passwordLimit = failureLimit(10, 15 * 60 * 1000);

export const actions = {
	default: async ({ cookies, request, getClientAddress }) => {
		const client = getClientAddress();
		if (passwordLimit.blocked(client)) return fail(429, { tooMany: true });
		const password = String((await request.formData()).get('password') ?? '');
		if (!passwordMatches(password)) {
			passwordLimit.fail(client);
			return fail(400, { wrongPassword: true });
		}
		signInTeacher(cookies);
		redirect(303, '/teacher');
	}
} satisfies Actions;
