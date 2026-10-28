"use client";

import { Check, CheckSquare, Copy, Download, MessageSquareText, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { BAKERY_SMS, groupBySupplier, smsHref, supplierMessage } from "@/lib/bakeries";
import { setOrdersStatus } from "./actions";

export type Pick = { id: string; code: string; name: string; items: { name: string; qty: number; bakery: string }[] };

const MAX = 100;
const Ctx = createContext<{ picked: Map<string, Pick>; toggle: (p: Pick) => void; setMany: (ps: Pick[]) => void; clear: () => void } | null>(null);

function useSel() {
  const c = useContext(Ctx);
  if (!c) throw new Error("SelectionProvider missing");
  return c;
}

/** "Custom batch": tick any orders, see their combined totals, copy/download for the supplier, or mark them all at once. */
export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [picked, setPicked] = useState<Map<string, Pick>>(new Map());
  const value = useMemo(
    () => ({
      picked,
      toggle: (p: Pick) =>
        setPicked((m) => {
          const n = new Map(m);
          if (n.has(p.id)) n.delete(p.id);
          else if (n.size < MAX) n.set(p.id, p);
          return n;
        }),
      setMany: (ps: Pick[]) => setPicked(new Map(ps.slice(0, MAX).map((p) => [p.id, p]))),
      clear: () => setPicked(new Map()),
    }),
    [picked],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <SelectionBar />
      {picked.size > 0 ? <div aria-hidden className="h-72" /> : null}
    </Ctx.Provider>
  );
}

export function SelectBox({ pick }: { pick: Pick }) {
  const { picked, toggle } = useSel();
  const on = picked.has(pick.id);
  return (
    <button
      type="button"
      onClick={() => toggle(pick)}
      aria-pressed={on}
      aria-label={`${on ? "Unselect" : "Select"} ${pick.code}`}
      className={`tap -m-2 flex size-11 shrink-0 items-center justify-center rounded-xl ${on ? "text-link" : "text-muted"}`}
    >
      {on ? <CheckSquare size={24} aria-hidden /> : <Square size={24} aria-hidden />}
    </button>
  );
}

export function SelectAll({ picks }: { picks: Pick[] }) {
  const { picked, setMany, clear } = useSel();
  if (picks.length === 0) return null;
  const all = picks.every((p) => picked.has(p.id));
  return (
    <button
      type="button"
      onClick={() => (all ? clear() : setMany(picks))}
      className="tap flex min-h-11 w-fit items-center gap-2 rounded-full bg-sunken px-4 text-[15px] font-medium text-link"
    >
      {all ? <CheckSquare size={18} aria-hidden /> : <Square size={18} aria-hidden />}
      {all ? "Unselect all" : `Select all ${Math.min(picks.length, MAX)}`}
    </button>
  );
}

function SelectionBar() {
  const { picked, clear } = useSel();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (picked.size === 0) return null;

  // One supplier message per bakery: each bakery is ordered separately.
  const totals = new Map<string, { bakery: string; name: string; qty: number }>();
  for (const p of picked.values())
    for (const i of p.items) {
      const key = `${i.bakery}\u0000${i.name}`;
      const cur = totals.get(key) ?? { bakery: i.bakery, name: i.name, qty: 0 };
      cur.qty += i.qty;
      totals.set(key, cur);
    }
  const groups = groupBySupplier([...totals.values()], (r) => r.name);
  const pieces = [...totals.values()].reduce((n, r) => n + r.qty, 0);
  const ids = [...picked.keys()];

  async function copy(bakery: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(bakery);
    setTimeout(() => setCopied((c) => (c === bakery ? null : c)), 2000);
  }

  function mark(status: "ordered" | "delivered") {
    setBusy(status);
    setMsg(null);
    start(async () => {
      const r = await setOrdersStatus(ids, status);
      setBusy(null);
      setMsg(r.message ?? null);
      if (r.ok) {
        clear();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-auto md:right-4 md:w-[26rem] md:px-0">
      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[16px] font-semibold">
            <span className="num">{picked.size}</span> order(s) · <span className="num">{pieces}</span> pcs
            {picked.size >= MAX ? <span className="text-[13px] font-normal text-muted"> (max)</span> : null}
          </p>
          <button type="button" onClick={clear} aria-label="Clear selection" className="tap flex size-11 items-center justify-center rounded-full text-muted">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="flex max-h-40 flex-col gap-3 overflow-y-auto text-[14px]">
          {groups.map(([bakery, rows]) => (
            <div key={bakery}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-muted">{bakery}</p>
                <div className="flex items-center gap-1.5">
                {BAKERY_SMS[bakery] ? (
                  <a
                    href={smsHref(BAKERY_SMS[bakery], supplierMessage(rows.map((r) => ({ name: r.name, qty: r.qty }))))}
                    className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-medium text-accent-ink"
                  >
                    <MessageSquareText size={15} aria-hidden /> Text
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => copy(bakery, supplierMessage(rows.map((r) => ({ name: r.name, qty: r.qty }))))}
                  className="tap flex min-h-11 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] font-medium text-link"
                >
                  {copied === bakery ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied === bakery ? "Copied" : "Copy"}
                </button>
                </div>
              </div>
              <ul className="flex flex-col gap-0.5">
                {rows.map((r) => (
                  <li key={r.name} className="flex justify-between gap-3">
                    <span>{r.name}</span>
                    <span className="num font-semibold">{r.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`/admin/batch/export?orders=${ids.join(",")}`}
            className="tap col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-soft px-4 text-[15px] font-medium text-link"
          >
            <Download size={18} aria-hidden /> Excel (one tab per bakery)
          </a>
          <Button variant="secondary" className="!px-3 !text-[16px] whitespace-nowrap" loading={busy === "ordered"} disabled={pending} onClick={() => mark("ordered")}>
            Mark Ordered
          </Button>
          <Button className="!px-3 !text-[16px] whitespace-nowrap" loading={busy === "delivered"} disabled={pending} onClick={() => mark("delivered")}>
            Mark Complete
          </Button>
        </div>
        {msg ? (
          <p role="status" className="text-[13px] text-muted">
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
