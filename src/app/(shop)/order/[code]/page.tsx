import type { Metadata } from "next";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import { getPaymentQrs } from "@/lib/shop";
import { Confirmation } from "./confirmation";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function OrderPage(props: PageProps<"/order/[code]">) {
  const { code } = await props.params;
  const qrs = (await getPaymentQrs()).map((q) => ({
    id: q.id,
    label: q.label,
    accountName: q.account_name,
    accountNumber: q.account_number,
    imageUrl: publicStorageUrl(SITE_BUCKET, q.image_path),
  }));
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16">
      <Confirmation code={decodeURIComponent(code).toUpperCase()} qrs={qrs} />
    </main>
  );
}
