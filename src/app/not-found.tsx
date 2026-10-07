import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-[64px] leading-none text-link">404</p>
      <h1 className="font-display text-[26px] leading-tight">We couldn&apos;t find that page</h1>
      <p className="text-muted">The link may be old or mistyped.</p>
      <Link href="/" className={buttonClass("primary", "lg")}>
        Back to shop
      </Link>
    </main>
  );
}
