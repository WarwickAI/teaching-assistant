import { getSettings } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => ({ lessonName: (await getSettings()).lessonName.trim() });
