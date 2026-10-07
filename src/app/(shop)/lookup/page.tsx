import type { Metadata } from "next";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = { title: "Check your order" };

export default function LookupPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16">
      <h1 className="font-display text-[34px] leading-tight">Check your order</h1>
      <p className="mt-1 mb-6 text-muted">Enter your order number and the mobile number you used.</p>
      <LookupForm />
    </main>
  );
}
