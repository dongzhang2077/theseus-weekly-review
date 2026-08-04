export function formatRecordedDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;

  if (hours > 0) {
    return remainder > 0
      ? `${hours}h ${minutes}m ${remainder}s`
      : `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }
  return `${remainder}s`;
}

export function formatEvidenceDate(isoDate: string, options?: { weekday?: boolean }): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...(options?.weekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
  }).format(value);
}
