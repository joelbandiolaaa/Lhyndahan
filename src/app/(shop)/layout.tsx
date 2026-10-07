import Link from "next/link";
import { CartButton } from "@/components/shop/cart-button";
import { Tracker } from "@/components/shop/tracker";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Tracker />
      <header className="sticky top-0 z-30 bg-accent text-accent-ink">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="tap -ml-1 flex min-h-11 items-center px-1 font-display text-[19px] text-accent-ink">
            Lhyndahan
          </Link>
          <CartButton />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mx-auto w-full max-w-5xl px-4 pt-12 pb-[calc(7rem+env(safe-area-inset-bottom))] text-[13px] text-muted">
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-black/[0.08] pt-5">
          <Link href="/lookup" className="text-link">
            Check your order
          </Link>
          <span>Pre-order only. Delivery every Friday and Saturday.</span>
        </div>
        <p className="mt-5 text-center text-[13px] text-muted">
          Need a system for your business? →{" "}
          <a href="https://joelbandiola.com" target="_blank" rel="noopener" className="text-link">
            joelbandiola.com
          </a>
        </p>
      </footer>
    </div>
  );
}
