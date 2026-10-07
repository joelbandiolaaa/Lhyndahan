import { requireAdmin } from "@/lib/auth";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import { PasswordForm } from "../account/password-form";
import { GcashSettings } from "./gcash-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, email } = await requireAdmin();
  const { data } = await supabase.from("settings").select("gcash_qr_path, gcash_name, gcash_number").eq("id", 1).single();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[34px] leading-tight">Settings</h1>
      <GcashSettings
        qrUrl={data?.gcash_qr_path ? publicStorageUrl(SITE_BUCKET, data.gcash_qr_path) : null}
        name={data?.gcash_name ?? ""}
        number={data?.gcash_number ?? ""}
      />
      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Account · {email}</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
