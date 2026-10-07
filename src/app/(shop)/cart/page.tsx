import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-2 pb-36">
      <Link href="/" className="tap -ml-2 flex min-h-11 w-fit items-center gap-0.5 px-2 text-[15px] font-medium text-link">
        <ChevronLeft size={20} aria-hidden /> Shop
      </Link>
      <h1 className="font-display text-[28px] leading-tight">Your cart</h1>
      <CartView />
    </main>
  );
}
