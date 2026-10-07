"use client";

/* eslint-disable @next/next/no-img-element -- small uploaded payment QR */

import { Camera, CheckCircle2, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderSummary } from "@/components/shop/order-summary";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPeso } from "@/lib/money";
import { findOrder, type OrderView } from "../actions";
import { LookupForm } from "../../lookup/lookup-form";

/**
 * Right after checkout the phone number is in sessionStorage (never in the URL),
 * so we can show the full order. Opened later or on another phone, it asks for
 * the phone number instead.
 */
export type ConfirmationQr = { id: string; label: string; accountName: string | null; accountNumber: string | null; imageUrl: string };

export function Confirmation({ code, qrs }: { code: string; qrs: ConfirmationQr[] }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [fresh, setFresh] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const payQr = qrs.find((q) => q.id === order?.qr_id) ?? null;

  useEffect(() => {
    let phone: string | null = null;
    try {
      const raw = sessionStorage.getItem(`hopia-order:${code}`);
      phone = raw ? (JSON.parse(raw).phone as string) : null;
    } catch {
      /* ignore */
    }
    if (!phone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading sessionStorage once on mount
      setFresh(false);
      return;
    }
    setFresh(true);
    findOrder(code, phone).then((r) => setOrder(r.order ?? null));
  }, [code]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is on screen anyway */
    }
  }

  if (fresh === false) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-[34px] leading-tight">Order {code}</h1>
        <p className="-mt-3 text-muted">Enter the mobile number you used to see your order.</p>
        <LookupForm defaultCode={code} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <CheckCircle2 size={56} strokeWidth={1.4} className="text-success" aria-hidden />
        <h1 className="font-display text-[34px] leading-tight">Thank you! We received your order.</h1>
        <p className="text-muted">Your order number:</p>
        <button
          type="button"
          onClick={copyCode}
          className="tap flex items-center gap-2 rounded-full border-2 border-accent bg-surface px-5 py-2"
          aria-label={`Copy order number ${code}`}
        >
          <span className="font-display text-[28px] tracking-normal text-link">{code}</span>
          <Copy size={18} className="text-link" aria-hidden />
        </button>
        <p className="h-5 text-[13px] text-success" role="status">
          {copied ? "Copied!" : ""}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-accent-soft px-4 py-3">
        <Camera size={20} className="mt-0.5 shrink-0 text-link" aria-hidden />
        <p className="text-[15px] text-ink">
          <span className="font-semibold">Screenshot this page</span> or save your order number{" "}
          <span className="font-semibold">{code}</span>. We&apos;ll ask for it if you message us on Messenger.
        </p>
      </div>

      {order && order.payment_method !== "cod" && !order.paid ? (
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Next: pay with {order.qr_provider ?? "QR code"}</h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[15px] text-muted">
            <li>
              Pay the exact total of <span className="num font-semibold text-ink">{formatPeso(order.total)}</span> using the QR code below.
            </li>
            <li>
              Screenshot your payment and send it to us on Messenger with your order number{" "}
              <span className="font-semibold text-ink">{code}</span>.
            </li>
            <li>We&apos;ll confirm it, and your order will show as &quot;Paid&quot;.</li>
          </ol>
          {payQr ? (
            <div className="mt-4 flex flex-col items-center gap-2 text-center">
              <img src={payQr.imageUrl} alt={`${payQr.label} QR code`} className="w-60 max-w-full rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
              {payQr.accountName ? <p className="text-[15px]">{payQr.accountName}</p> : null}
              {payQr.accountNumber ? <p className="num text-[17px] font-semibold">{payQr.accountNumber}</p> : null}
              <p className="text-[13px] text-muted">
                Paying from this phone? Press and hold the QR to save it, then open {payQr.label} and upload it from your gallery.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-[15px] text-muted">We&apos;ll send you the payment details on Messenger.</p>
          )}
        </Card>
      ) : null}

      {order ? <OrderSummary order={order} /> : <div aria-hidden className="h-56 animate-pulse rounded-[var(--radius-card)] bg-surface" />}

      <p className="text-center text-[13px] text-muted">
        Save your order number. You can check your order status anytime at{" "}
        <Link href="/lookup" className="text-link">
          Check order
        </Link>
        .
      </p>
      <Link href="/" className={buttonClass("secondary", "lg")}>
        Back to shop
      </Link>
    </div>
  );
}
