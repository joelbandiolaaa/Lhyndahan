"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { SITE_BUCKET } from "@/lib/env";
import type { ActionResult } from "@/lib/types";

const gcashSchema = z.object({
  gcash_name: z.string().trim().max(80, "Too long."),
  gcash_number: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^09\d{2} ?\d{3} ?\d{4}$/.test(v), "Enter a valid GCash number, e.g. 0917 123 4567."),
});

function refresh() {
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

export async function saveGcashDetails(input: { gcash_name: string; gcash_number: string }): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = gcashSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, message: "Please check the form.", fieldErrors: fe };
  }
  const { error } = await supabase
    .from("settings")
    .update({ gcash_name: parsed.data.gcash_name || null, gcash_number: parsed.data.gcash_number || null })
    .eq("id", 1);
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  refresh();
  return { ok: true, message: "Saved." };
}

/** Called after the browser uploaded the QR straight to Storage. Removes the old one. */
export async function setGcashQr(path: string | null): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (path !== null && (!path.startsWith("gcash/") || path.includes(".."))) return { ok: false, message: "Invalid file." };

  const { data: current } = await supabase.from("settings").select("gcash_qr_path").eq("id", 1).single();
  const { error } = await supabase.from("settings").update({ gcash_qr_path: path }).eq("id", 1);
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  if (current?.gcash_qr_path && current.gcash_qr_path !== path) {
    await supabase.storage.from(SITE_BUCKET).remove([current.gcash_qr_path]);
  }
  refresh();
  return { ok: true, message: path ? "GCash QR uploaded." : "GCash QR removed." };
}
