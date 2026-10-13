import { readConfig } from '$lib/server/config';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({ lessonName: readConfig().lesson_name?.trim() ?? '' });
