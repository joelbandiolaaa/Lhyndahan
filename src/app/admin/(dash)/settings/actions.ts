"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { SITE_BUCKET } from "@/lib/env";
import type { ActionResult } from "@/lib/types";

const qrFields = z.object({
  label: z.string().trim().min(1, "Enter a name, e.g. GCash.").max(40, "Too long."),
  account_name: z.string().trim().max(80, "Too long."),
  account_number: z.string().trim().max(40, "Too long."),
});

const validPath = (p: string) => p.startsWith("qr/") && !p.includes("..");

function refresh() {
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

function fieldErrors(error: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of error.issues) fe[String(i.path[0])] ??= i.message;
  return fe;
}

/** Called after the browser uploaded the QR image straight to Storage. */
export async function addPaymentQr(input: { label: string; account_name: string; account_number: string; path: string }): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = qrFields.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
  if (!validPath(input.path)) return { ok: false, message: "Invalid file." };

  const { data: last } = await supabase.from("payment_qrs").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("payment_qrs").insert({
    label: parsed.data.label,
    account_name: parsed.data.account_name || null,
    account_number: parsed.data.account_number || null,
    image_path: input.path,
    sort_order: (last?.[0]?.sort_order ?? 0) + 1,
  });
  if (error) {
    await supabase.storage.from(SITE_BUCKET).remove([input.path]);
    return { ok: false, message: "Couldn't save. Please try again." };
  }
  refresh();
  return { ok: true, message: `${parsed.data.label} QR added.` };
}

export async function updatePaymentQr(id: string, input: { label: string; account_name: string; account_number: string }): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = qrFields.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase
    .from("payment_qrs")
    .update({ label: parsed.data.label, account_name: parsed.data.account_name || null, account_number: parsed.data.account_number || null })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  refresh();
  return { ok: true, message: "Saved." };
}

/** Hiding keeps the QR and all orders that used it; it just stops being offered at checkout. */
export async function setPaymentQrActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("payment_qrs").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  refresh();
  return { ok: true, message: active ? "Shown at checkout." : "Hidden from checkout." };
}

export async function deletePaymentQr(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: row } = await supabase.from("payment_qrs").select("image_path").eq("id", id).single();
  const { error } = await supabase.from("payment_qrs").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't remove. Please try again." };
  if (row?.image_path) await supabase.storage.from(SITE_BUCKET).remove([row.image_path]);
  refresh();
  return { ok: true, message: "QR removed." };
}
