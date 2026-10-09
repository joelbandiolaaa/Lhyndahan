"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartCount, cartTotal, useCart } from "@/lib/cart";
import { formatPeso } from "@/lib/money";

/**
 * Floating pink "View cart" bar, shown on browsing pages once the cart has items.
 * Rendered after the footer, with a spacer, so no fixed bottom bar ever covers the footer.
 */
export function CartBar() {
  const lines = useCart();
  const pathname = usePathname();
  const count = cartCount(lines);
  const onProduct = pathname.startsWith("/p/");
  const onCart = pathname.startsWith("/cart");
  const hidden =
    count === 0 ||
    onCart ||
    pathname.startsWith("/checkout") ||
    onProduct ||
    pathname.startsWith("/order");
  const spacer = hidden ? (onProduct ? "md:hidden" : onCart ? "" : null) : "";
  if (hidden && spacer === null) return null;
  if (hidden) return <div aria-hidden className={`h-24 ${spacer}`} />;

  return (
    <>
      <div aria-hidden className="h-24" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Link
          href="/cart"
          className="tap pointer-events-auto mx-auto flex min-h-14 max-w-xl items-center gap-3 rounded-xl bg-accent px-4 text-accent-ink shadow-[0_6px_20px_rgba(233,8,47,0.35)]"
        >
          <span className="num flex size-7 items-center justify-center rounded-full border-2 border-white/80 text-[14px] font-semibold">
            {count}
          </span>
          <span className="flex-1 text-[17px] font-semibold">View cart</span>
          <span className="num text-[17px] font-semibold">
            {formatPeso(cartTotal(lines))}
          </span>
        </Link>
      </div>
    </>
  );
}
