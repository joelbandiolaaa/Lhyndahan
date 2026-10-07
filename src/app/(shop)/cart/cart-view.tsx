"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductImg } from "@/components/product-image";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/card";
import { cartCount, cartTotal, replaceCart, setQty, useCart } from "@/lib/cart";
import { formatPeso } from "@/lib/money";
import { refreshCart } from "./actions";

export function CartView() {
  const lines = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const checked = useRef(false);

  // Once per visit: update prices/names and drop products that are no longer sold.
  useEffect(() => {
    if (checked.current || lines.length === 0) return;
    checked.current = true;
    refreshCart(lines.map((l) => l.productId))
      .then((fresh) => {
        const byId = new Map(fresh.map((f) => [f.productId, f]));
        const next = lines.flatMap((l) => {
          const f = byId.get(l.productId);
          return f ? [{ ...f, qty: l.qty }] : [];
        });
        const removed = lines.length - next.length;
        const repriced = next.some((n) => lines.find((l) => l.productId === n.productId)?.price !== n.price);
        if (removed || repriced) {
          replaceCart(next);
          setNotice(
            removed
              ? `${removed} ${removed === 1 ? "item is" : "items are"} no longer available and ${removed === 1 ? "was" : "were"} removed from your cart.`
              : "Some prices have been updated.",
          );
        }
      })
      .catch(() => {
        // Offline: keep the saved cart; checkout re-checks prices anyway.
      });
  }, [lines]);

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        body="Pick something from the shop and tap the + button."
        action={
          <Link href="/" className={buttonClass("primary")}>
            Go to shop
          </Link>
        }
      />
    );
  }

  const total = cartTotal(lines);

  return (
    <div className="mt-5 flex flex-col gap-4">
      {notice ? <Notice>{notice}</Notice> : null}

      <section className="rounded-[var(--radius-card)] bg-surface">
        <ul className="flex flex-col divide-y divide-line">
          {lines.map((l) => (
            <li key={l.productId} className="flex gap-3 p-4">
              <Link href={`/p/${l.slug}`} className="shrink-0">
                <ProductImg path={l.imagePath} name={l.name} alt={l.name} className="size-[72px] rounded-xl text-[18px]" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] leading-snug font-semibold">{l.name}</p>
                  <p className="num shrink-0 text-[16px]">{formatPeso(l.price * l.qty)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="num text-[14px] text-muted">{formatPeso(l.price)} each</p>
                  <QtyStepper value={l.qty} onChange={(n) => setQty(l.productId, n)} label={l.name} removable />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/" className="flex min-h-12 items-center gap-2 border-t border-line px-4 text-[15px] font-medium text-link">
          <Plus size={18} aria-hidden /> Add more items
        </Link>
      </section>

      <section className="rounded-[var(--radius-card)] bg-surface p-4">
        <h2 className="text-[17px] font-semibold">Summary</h2>
        <dl className="mt-3 flex flex-col gap-2 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal · <span className="num">{cartCount(lines)}</span> {cartCount(lines) === 1 ? "item" : "items"}</dt>
            <dd className="num">{formatPeso(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="text-success">Included</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-3 text-[17px] font-semibold">
            <dt>Total</dt>
            <dd className="num">{formatPeso(total)}</dd>
          </div>
        </dl>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <Link href="/checkout" className={buttonClass("primary", "lg", "justify-between rounded-xl px-5")}>
            <span>Checkout</span>
            <span className="num">{formatPeso(total)}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
