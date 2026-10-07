"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Batch } from "@/lib/admin";
import { formatDay } from "@/lib/dates";

const selectClass =
  "min-h-11 rounded-full border border-line bg-surface pr-8 pl-4 text-[15px] text-ink appearance-none " +
  "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236e6e73%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat";

const FILTERS = [
  { key: "paid", label: "Payment", options: [["", "Payment: all"], ["unpaid", "Unpaid"], ["paid", "Paid"]] },
  { key: "delivery", label: "Delivery", options: [["", "Delivery: all"], ["office", "KUS (Friday)"], ["outside", "Outside (Saturday)"]] },
  { key: "pay", label: "Payment method", options: [["", "COD and GCash"], ["cod", "COD"], ["gcash", "GCash"]] },
] as const;

export function OrderFilters({ batches, currentBatchId }: { batches: Batch[]; currentBatchId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const active = FILTERS.filter((f) => params.get(f.key)).length + (params.get("q") ? 1 : 0);

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", q.trim());
        }}
        className="relative"
      >
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or LH-0012"
          aria-label="Search orders"
          className="min-h-11 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-[16px] outline-none focus:border-accent"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="flt-batch">Batch</label>
        <select
          id="flt-batch"
          className={selectClass}
          value={params.get("batch") ?? currentBatchId ?? "all"}
          onChange={(e) => update("batch", e.target.value)}
        >
          <option value="all">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              Batch {formatDay(b.office_date, { weekday: false })}
              {b.id === currentBatchId ? " (current)" : ""}
            </option>
          ))}
        </select>
        {FILTERS.map((f) => (
          <span key={f.key}>
            <label className="sr-only" htmlFor={`flt-${f.key}`}>{f.label}</label>
            <select id={`flt-${f.key}`} className={selectClass} value={params.get(f.key) ?? ""} onChange={(e) => update(f.key, e.target.value)}>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </span>
        ))}
        {active > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              const keep = params.get("batch");
              start(() => router.replace(keep ? `${pathname}?batch=${keep}` : pathname, { scroll: false }));
            }}
            className="tap flex min-h-11 items-center gap-1 rounded-full px-3 text-[15px] text-link"
          >
            <X size={16} aria-hidden /> Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
