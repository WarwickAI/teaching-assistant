import { error } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { requireTeacher } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type Feedback = { studentId: string; rating: number; comment: string | null; createdAt: string };

// Quotes every field, and stops spreadsheets running a comment that starts like a formula.
const cell = (value: string | number) => {
	const text = String(value);
	return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};

// The latest lesson's feedback, for opening in a spreadsheet.
export const GET: RequestHandler = async ({ cookies }) => {
	requireTeacher(cookies);
	const res = await api('/dashboard');
	if (!res.ok) error(502, "Couldn't load the feedback");
	const { feedback }: { feedback: Feedback[] } = await res.json();
	const rows = [
		['Student ID', 'Rating', 'Comment', 'Submitted at'],
		...feedback.map((f) => [f.studentId, f.rating, f.comment ?? '', f.createdAt])
	];
	const date = new Date().toISOString().slice(0, 10);
	// The byte order mark tells Excel the file is UTF-8.
	return new Response('﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n', {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="feedback-${date}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
