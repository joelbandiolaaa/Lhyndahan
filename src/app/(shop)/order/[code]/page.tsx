import type { Metadata } from "next";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/shop";
import { Confirmation } from "./confirmation";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function OrderPage(props: PageProps<"/order/[code]">) {
  const { code } = await props.params;
  const s = await getPublicSettings();
  const gcash = {
    qrUrl: s?.gcash_qr_path ? publicStorageUrl(SITE_BUCKET, s.gcash_qr_path) : null,
    name: s?.gcash_name ?? null,
    number: s?.gcash_number ?? null,
  };
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16">
      <Confirmation code={decodeURIComponent(code).toUpperCase()} gcash={gcash} />
    </main>
  );
}
