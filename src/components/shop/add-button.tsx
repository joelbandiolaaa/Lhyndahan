"use client";

import { Plus } from "lucide-react";
import { addToCart, useCart, type CartLine } from "@/lib/cart";

/**
 * Round "+" on the product photo, food-app style. Once the item is in the
 * cart it turns pink and shows how many; each tap adds one more.
 */
export function AddButton({ line }: { line: Omit<CartLine, "qty"> }) {
  const qty = useCart().find((l) => l.productId === line.productId)?.qty ?? 0;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart(line, 1);
      }}
      aria-label={qty ? `Add another ${line.name} (${qty} in cart)` : `Add to cart: ${line.name}`}
      className={`tap flex size-10 items-center justify-center rounded-full text-[15px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.18)] ${
        qty ? "bg-accent text-accent-ink" : "bg-surface text-link"
      }`}
    >
      {qty ? <span className="num">{qty}</span> : <Plus size={22} strokeWidth={2.4} aria-hidden />}
    </button>
  );
}
