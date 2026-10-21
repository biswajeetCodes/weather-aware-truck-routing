export function formatDuration(minutes) {
  const roundedMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(roundedMinutes / 60)}h ${String(roundedMinutes % 60).padStart(2, "0")}m`;
}
