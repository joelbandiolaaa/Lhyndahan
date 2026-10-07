import { requireAdmin } from "@/lib/auth";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import { PasswordForm } from "../account/password-form";
import { PaymentQrSettings, type QrRow } from "./payment-qr-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, email } = await requireAdmin();
  const { data } = await supabase
    .from("payment_qrs")
    .select("id, label, account_name, account_number, image_path, is_active")
    .order("sort_order")
    .order("created_at");
  const qrs: QrRow[] = (data ?? []).map((q) => ({
    id: q.id,
    label: q.label,
    accountName: q.account_name ?? "",
    accountNumber: q.account_number ?? "",
    imageUrl: publicStorageUrl(SITE_BUCKET, q.image_path),
    active: q.is_active,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[34px] leading-tight">Settings</h1>
      <PaymentQrSettings qrs={qrs} />
      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Account · {email}</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
