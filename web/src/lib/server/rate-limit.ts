// Counts failed attempts per client in a sliding window. Kept in memory, as only one instance of the app runs.
// Only failures count, so a whole class behind one campus IP address can still get in.
export function failureLimit(max: number, windowMs: number) {
	const failures = new Map<string, number[]>();
	const recent = (key: string) => {
		const times = (failures.get(key) ?? []).filter((time) => time > Date.now() - windowMs);
		if (times.length) failures.set(key, times);
		else failures.delete(key);
		return times;
	};
	return {
		blocked: (key: string) => recent(key).length >= max,
		fail: (key: string) => failures.set(key, [...recent(key), Date.now()])
	};
}
