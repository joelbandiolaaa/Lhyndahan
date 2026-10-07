"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-[26px] leading-tight">Something went wrong</h1>
      <p className="text-muted">Please try again. If it keeps happening, message us and we&apos;ll sort it out.</p>
      <div className="flex w-full flex-col gap-3">
        <button type="button" onClick={() => retry()} className={buttonClass("primary", "lg")}>
          Try again
        </button>
        <Link href="/" className={buttonClass("secondary", "lg")}>
          Back to shop
        </Link>
      </div>
    </main>
  );
}
