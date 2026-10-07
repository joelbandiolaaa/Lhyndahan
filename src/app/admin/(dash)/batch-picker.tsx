"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Batch } from "@/lib/admin";
import { formatDay } from "@/lib/dates";

export function BatchPicker({ batches, value, currentId }: { batches: Batch[]; value: string | null; currentId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  if (batches.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-[15px] text-muted">
      <span className="sr-only">Batch</span>
      <select
        value={value ?? ""}
        onChange={(e) => router.replace(`${pathname}?batch=${e.target.value}`, { scroll: false })}
        className="min-h-11 rounded-full border border-line bg-surface px-4 text-[15px] text-ink"
      >
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            Batch {formatDay(b.office_date, { weekday: false })}
            {b.id === currentId ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
