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

/** timestamptz → value for <input type="datetime-local"> in Manila time ("2026-10-10T09:00"), or "". */
export function toManilaInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

/** The reverse: a Manila "2026-10-10T09:00" from the form → ISO timestamp, or null when blank/invalid. */
export function fromManilaInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
