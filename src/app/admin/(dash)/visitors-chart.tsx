import { formatDay } from "@/lib/dates";

/**
 * Single-series bar chart of daily unique visitors. One hue (accent), no
 * legend (the title names it), thin bars with a rounded data end on a
 * baseline, 2px gaps, per-bar tooltip, and a table for screen readers.
 */
export function VisitorsChart({ daily }: { daily: { day: string; visitors: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const peak = daily.reduce((a, b) => (b.visitors > a.visitors ? b : a), daily[0]);

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-28 items-end gap-[2px] border-b border-black/[0.12]" aria-hidden>
        {daily.map((d) => {
          const h = d.visitors === 0 ? 0 : Math.max(4, Math.round((d.visitors / max) * 100));
          return (
            <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
              <div className="w-full max-w-7 rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80" style={{ height: `${h}%` }} />
              <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded-lg bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-white group-hover:block">
                {formatDay(d.day, { weekday: false })}: <span className="num">{d.visitors}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] text-[11px] text-muted" aria-hidden>
        {daily.map((d) => (
          <span key={d.day} className="flex-1 text-center">
            {new Intl.DateTimeFormat("en-PH", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${d.day}T00:00:00Z`))}
          </span>
        ))}
      </div>
      {peak && peak.visitors > 0 ? (
        <figcaption className="text-[13px] text-muted">
          Busiest day: <span className="num text-ink">{peak.visitors}</span> visitors on {formatDay(peak.day)}
        </figcaption>
      ) : (
        <figcaption className="text-[13px] text-muted">No visitors yet. Share your shop link on Facebook.</figcaption>
      )}
      <table className="sr-only">
        <caption>Visitors per day</caption>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{d.visitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
