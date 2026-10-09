import Link from "next/link";
import { CartBar } from "@/components/shop/cart-bar";
import { CartButton } from "@/components/shop/cart-button";
import { Wordmark } from "@/components/logo";
import { Tracker } from "@/components/shop/tracker";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lhyndahan.vercel.app";

// Tells search engines the shop's name and logo (the favicon/icon files do the rest).
const ORG_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lhyndahan",
  url: SITE,
  logo: `${SITE}/icon.png`,
});

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORG_JSON_LD }} />
      <Tracker />
      <header className="sticky top-0 z-30 bg-accent text-accent-ink">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" aria-label="Lhyndahan home" className="tap -ml-1 flex min-h-11 items-center px-1">
            <Wordmark height={34} />
          </Link>
          <CartButton />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-[13px] leading-relaxed text-muted">
        <div className="border-t border-black/[0.08] pt-5">
          <p>Pre-order only. Delivery every Friday and Saturday.</p>
          <p>
            <Link href="/lookup" className="tap inline-flex min-h-11 items-center text-link">
              Check your order
            </Link>
          </p>
          <p>
            <Link href="/privacy" className="tap inline-flex min-h-11 items-center text-link">
              Privacy
            </Link>
            {process.env.NEXT_PUBLIC_MESSENGER_URL ? (
              <>
                {" · "}
                <a href={process.env.NEXT_PUBLIC_MESSENGER_URL} target="_blank" rel="noopener noreferrer" className="tap inline-flex min-h-11 items-center text-link">
                  Message us
                </a>
              </>
            ) : null}
          </p>
          <p className="mt-1">
            Need a system for your business? →{" "}
            <a href="https://joelbandiola.com" target="_blank" rel="noopener" className="inline-block py-3 text-link">
              joelbandiola.com
            </a>
          </p>
        </div>
      </footer>
      <CartBar />
    </div>
  );
}
