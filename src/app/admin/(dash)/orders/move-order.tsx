"use client";

import { Check, Copy, MoveRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/dates";
import { moveOrderToBatch } from "./actions";

export type MoveTarget = { id: string; office_date: string; outside_date: string; supplier_ordered: boolean };

/** "Change delivery": put this order into another batch (e.g. the one that just closed) so it joins that batch's supplier order and delivery list. */
export function MoveOrder({
  orderId,
  code,
  name,
  deliveryType,
  currentBatchId,
  targets,
  compact = false,
}: {
  orderId: string;
  code: string;
  name: string;
  deliveryType: "office" | "outside";
  currentBatchId: string;
  targets: MoveTarget[];
  compact?: boolean;
}) {
  const dateOf = (t: MoveTarget) => (deliveryType === "office" ? t.office_date : t.outside_date);
  const options = targets.filter((t) => t.id !== currentBatchId);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(options[0]?.id ?? "");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string; date?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (options.length === 0) return null;

  function go() {
    setResult(null);
    start(async () => {
      const r = await moveOrderToBatch(orderId, pick);
      setResult({ ok: r.ok, message: r.message, date: r.ok ? r.deliveryDate : undefined });
    });
  }

  const note = result?.date ? `Hi ${name}! Your order ${code} will be delivered on ${formatDay(result.date)}. Thank you!` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(note);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = note;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // One-tap mode (Batch page): the target is the only option, so skip the picker.
  if (compact && !result?.ok) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="secondary" loading={pending} disabled={pending} onClick={go}>
          <MoveRight size={18} aria-hidden /> Add to this batch
        </Button>
        {result && !result.ok ? (
          <p role="alert" className="text-sm text-danger">
            {result.message}
          </p>
        ) : null}
      </div>
    );
  }

  if (!open && !compact) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <MoveRight size={18} aria-hidden /> Change delivery
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl bg-sunken p-3">
      {result?.ok ? (
        <>
          <p role="status" className="text-[15px]">{result.message}</p>
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied ? "Copied" : "Copy customer message"}
          </Button>
          <Button variant="ghost" onClick={() => router.refresh()}>
            Done
          </Button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-[14px] text-muted">
            Deliver with which batch?
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink"
            >
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatDay(dateOf(t))} ({deliveryType === "office" ? "KUS" : "My address"}){t.supplier_ordered ? " · already ordered from supplier" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} disabled={pending || !pick} onClick={go}>
              Move order
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {result && !result.ok ? (
            <p role="alert" className="text-sm text-danger">
              {result.message}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
