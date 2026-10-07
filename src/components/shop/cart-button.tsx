"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";

export function CartButton() {
  const count = cartCount(useCart());
  return (
    <Link
      href="/cart"
      aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart, empty"}
      className="tap relative -mr-2 flex size-11 items-center justify-center rounded-full text-accent-ink"
    >
      <ShoppingBag size={22} strokeWidth={1.6} aria-hidden />
      {count > 0 ? (
        <span className="num absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-surface px-1 text-[11px] font-semibold text-link">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
