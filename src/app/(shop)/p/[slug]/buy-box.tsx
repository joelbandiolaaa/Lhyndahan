"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { buttonClass } from "@/components/ui/button";
import { addToCart, type CartLine } from "@/lib/cart";
import { formatPeso } from "@/lib/money";

export function BuyBox({ line }: { line: Omit<CartLine, "qty"> }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {added ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[15px] text-success" role="status">
            <Check size={18} aria-hidden /> Added to cart
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdded(false)} className={buttonClass("secondary", "md", "rounded-xl")}>
              Add more
            </button>
            <Link href="/cart" className={buttonClass("primary", "md", "flex-1 rounded-xl")}>
              View cart
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <QtyStepper value={qty} onChange={setQty} label={line.name} />
          <button
            type="button"
            onClick={() => {
              addToCart(line, qty);
              setAdded(true);
              setQty(1);
            }}
            className={buttonClass("primary", "md", "flex-1 justify-between whitespace-nowrap rounded-xl px-4")}
          >
            <span>Add to cart</span>
            <span className="num">{formatPeso(line.price * qty)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
