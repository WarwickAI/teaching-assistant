import { getSettings } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

// Fetched once here; the pages read the resources through parent().
export const load: LayoutServerLoad = async () => {
	const { lessonName, resources } = await getSettings();
	return { lessonName: lessonName.trim(), lessonResources: resources };
};
