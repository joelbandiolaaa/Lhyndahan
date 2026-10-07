"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, verifyPassword } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/admin";

export type AccountState = { ok?: boolean; message?: string };

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().min(10, "New password must be at least 10 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two new passwords don't match.", path: ["confirm"] });

export async function changePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { supabase, email } = await requireAdmin();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!(await verifyPassword(email, parsed.data.current))) return { ok: false, message: "Your current password is wrong." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      message: error.code === "same_password" ? "Must be different from your current password." : "Couldn't change it. Please try again.",
    };
  }
  // A changed password should end every other logged-in session (e.g. a forgotten phone).
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, message: "Password changed." };
}

const emailSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    email: z.email("Enter a valid email.").max(120),
    confirm: z.string(),
  })
  .refine((v) => v.email.toLowerCase() === v.confirm.trim().toLowerCase(), { message: "The two emails don't match.", path: ["confirm"] });

/**
 * Changes the login email AND the admin email in the database together; if either half fails
 * the other is undone, so the admin can never be locked out by a half-finished change.
 * The new address is not verified by email, which is why the current password is required
 * and the new address has to be typed twice.
 */
export async function changeEmail(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { supabase, email: oldEmail } = await requireAdmin();
  const parsed = emailSchema.safeParse({
    current: formData.get("current"),
    email: String(formData.get("email") ?? "").trim(),
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const newEmail = parsed.data.email.toLowerCase();
  if (newEmail === oldEmail.toLowerCase()) return { ok: false, message: "That's already your email." };
  if (!(await verifyPassword(oldEmail, parsed.data.current))) return { ok: false, message: "Your current password is wrong." };

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return { ok: false, message: "Please log in again." };

  const svc = supabaseService();
  const { data: settings } = await svc.from("settings").select("notify_email").eq("id", 1).single();
  const notify = settings?.notify_email?.toLowerCase() === oldEmail.toLowerCase() ? newEmail : (settings?.notify_email ?? null);

  const { error: authError } = await svc.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
  if (authError) {
    return {
      ok: false,
      message: authError.code === "email_exists" ? "That email is already used by another account." : "Couldn't change the email. Please try again.",
    };
  }
  const { error: settingsError } = await svc.from("settings").update({ admin_email: newEmail, notify_email: notify }).eq("id", 1);
  if (settingsError) {
    const { error: revertError } = await svc.auth.admin.updateUserById(userId, { email: oldEmail, email_confirm: true });
    if (revertError) {
      console.error("changeEmail: revert failed", revertError.message);
      return { ok: false, message: `Something went wrong and your login email may now be ${newEmail}. Try logging in with it, or ask for help.` };
    }
    return { ok: false, message: "Couldn't change the email. Nothing was changed." };
  }

  // The current session still carries the old email, so start fresh with the new one.
  await supabase.auth.signOut();
  redirect("/admin/login?changed=email");
}
