const TZ = "Asia/Manila";

/** "2026-10-09" (a calendar date) → "Friday, Oct 9" */
export function formatDay(isoDate: string, opts: { weekday?: boolean } = { weekday: true }): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PH", {
    weekday: opts.weekday ? "long" : undefined,
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * cutoff_at is the first instant AFTER the cutoff (e.g. Thu 00:00), so the
 * last minute customers can order is one minute earlier.
 */
export function formatCutoff(cutoffAt: string): string {
  const last = new Date(new Date(cutoffAt).getTime() - 60_000);
  const day = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "short", day: "numeric", timeZone: TZ }).format(last);
  const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(last);
  return `${day}, ${time}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}
