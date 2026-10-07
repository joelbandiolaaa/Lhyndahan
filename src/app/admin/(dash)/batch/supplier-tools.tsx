"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { markBatchOrdered } from "../orders/actions";

export function SupplierTools({ text, batchId, pendingCount }: { text: string; batchId: string; pendingCount: number }) {
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  async function copy() {
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4">
        <p className="text-[13px] text-muted">Message for supplier</p>
        <pre className="mt-2 font-sans text-[15px] whitespace-pre-wrap text-ink">{text}</pre>
      </Card>
      <Button size="lg" onClick={copy}>
        {copied ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
        {copied ? "Copied! Paste it to your supplier" : "Copy for Supplier"}
      </Button>
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
