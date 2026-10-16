// When each signed-in student's page last checked in. Kept in memory, as only one instance of the app runs.
// Pages check every 5 seconds while on screen, so anyone not heard from in 15 seconds has left or hidden the tab.
const lastSeen = new Map<string, number>();

export const markOnline = (studentId: string) => lastSeen.set(studentId, Date.now());
export const markOffline = (studentId: string) => lastSeen.delete(studentId);

export function onlineCount() {
	const cutoff = Date.now() - 15_000;
	for (const [studentId, time] of lastSeen) if (time < cutoff) lastSeen.delete(studentId);
	return lastSeen.size;
}
