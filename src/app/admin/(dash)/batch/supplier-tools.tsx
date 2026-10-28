"use client";

import { Check, Copy, MessageSquareText } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { smsHref } from "@/lib/bakeries";
import { markBatchOrdered } from "../orders/actions";

export type SupplierBlock = { bakery: string; contact: string | null; sms: string | null; text: string };

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older phones: fall back to a hidden textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/** One message per bakery (each bakery is a separate supplier), then one button to mark the batch as Ordered. */
export function SupplierTools({ blocks, batchId, pendingCount }: { blocks: SupplierBlock[]; batchId: string; pendingCount: number }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  async function copy(b: SupplierBlock) {
    await copyText(b.text);
    setCopied(b.bakery);
    setTimeout(() => setCopied((c) => (c === b.bakery ? null : c)), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b) => (
        <Card key={b.bakery} className="flex flex-col gap-3 p-4">
          <div>
            <p className="text-[16px] font-semibold">{b.bakery}</p>
            {b.contact ? <p className="text-[13px] text-muted">{b.contact}</p> : null}
          </div>
          <pre className="font-sans text-[15px] whitespace-pre-wrap text-ink">{b.text}</pre>
          {b.sms ? (
            <a href={smsHref(b.sms, b.text)} className={buttonClass("primary", "lg")}>
              <MessageSquareText size={20} aria-hidden /> Text this order
            </a>
          ) : null}
          <Button size="lg" variant={b.sms ? "secondary" : "primary"} onClick={() => copy(b)}>
            {copied === b.bakery ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
            {copied === b.bakery ? "Copied!" : `Copy for ${b.bakery}`}
          </Button>
        </Card>
      ))}
      <Button
        size="lg"
        variant="secondary"
        loading={pending}
        disabled={pendingCount === 0}
        onClick={() => {
          if (!confirm(`Mark ${pendingCount} pending order(s) in this batch as Ordered?`)) return;
          start(async () => setResult(await markBatchOrdered(batchId)));
        }}
      >
        {pendingCount === 0 ? "No pending orders" : `Mark all as Ordered (${pendingCount})`}
      </Button>
      {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
    </div>
  );
}
