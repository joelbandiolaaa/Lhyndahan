import type { Metadata } from "next";
import { getBatchPreview, getPaymentQrs } from "@/lib/shop";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [batch, qrs] = await Promise.all([getBatchPreview(), getPaymentQrs()]);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
      <h1 className="font-display text-[34px] leading-tight">Checkout</h1>
      <p className="mt-1 text-muted">No account needed.</p>
      <CheckoutForm batch={batch} qrs={qrs.map((q) => ({ id: q.id, label: q.label }))} />
    </main>
  );
}
