"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const schema = z
  .object({
    password: z.string().min(10, "Must be at least 10 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

export type PasswordState = { ok?: boolean; message?: string };

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const { supabase } = await requireAdmin();
  const parsed = schema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      message: error.code === "same_password" ? "Must be different from your current password." : "Couldn't change it. Please try again.",
    };
  }
  return { ok: true, message: "Password changed." };
}
