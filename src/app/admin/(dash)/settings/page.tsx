import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import { EmailForm } from "../account/email-form";
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
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl">Backup</h2>
        <p className="text-[15px] text-muted">
          One Excel file with everything: all orders (even cancelled), items, customers, products, categories and QR details. Download it
          every week and keep it in Google Drive. The free database has no automatic backup.
        </p>
        <a href="/admin/backup/export" className={buttonClass("secondary", "md", "self-start")}>
          <Download size={18} aria-hidden /> Download full backup
        </a>
      </Card>
      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Account · {email}</h2>
        <EmailForm currentEmail={email} />
        <PasswordForm />
      </div>
    </div>
  );
}
