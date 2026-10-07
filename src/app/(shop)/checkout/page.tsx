import type { Metadata } from "next";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import { getBatchPreview, getPublicSettings } from "@/lib/shop";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [batch, settings] = await Promise.all([getBatchPreview(), getPublicSettings()]);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
      <h1 className="font-display text-[34px] leading-tight">Checkout</h1>
      <p className="mt-1 text-muted">No account needed.</p>
      <CheckoutForm
        batch={batch}
        gcash={{
          qrUrl: settings?.gcash_qr_path ? publicStorageUrl(SITE_BUCKET, settings.gcash_qr_path) : null,
          name: settings?.gcash_name ?? null,
          number: settings?.gcash_number ?? null,
        }}
      />
    </main>
  );
}
