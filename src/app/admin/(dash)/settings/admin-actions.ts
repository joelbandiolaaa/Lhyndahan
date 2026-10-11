"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/admin";

export type AdminUserResult =
  | { ok: true; message: string; credentials?: { email: string; password: string } }
  | { ok: false; message: string };

const emailSchema = z.email("Enter a valid email.").max(120).transform((v) => v.trim().toLowerCase());
const passwordSchema = z.string().min(10, "The password must be at least 10 characters.").max(72, "The password is too long (max 72).");

/** Only the owner (settings.admin_email) may add or remove people. Everyone else is a plain admin. */
async function requireOwner() {
  const { email } = await requireAdmin();
  const svc = supabaseService();
  const { data } = await svc.from("settings").select("admin_email").eq("id", 1).single();
  const owner = (data?.admin_email ?? "").toLowerCase();
  if (!owner || owner !== email.toLowerCase()) return null;
  return { svc, owner };
}

async function findUserId(svc: ReturnType<typeof supabaseService>, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function addAdminUser(input: { email: string; password: string }): Promise<AdminUserResult> {
  const ctx = await requireOwner();
  if (!ctx) return { ok: false, message: "Only the owner can add admins." };
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, message: email.error.issues[0].message };
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, message: password.error.issues[0].message };
  if (email.data === ctx.owner) return { ok: false, message: "That's your own login." };

  const { data: existing } = await ctx.svc.from("admin_users").select("email").eq("email", email.data).maybeSingle();
  if (existing) return { ok: false, message: "That person is already an admin." };

  const { data: created, error } = await ctx.svc.auth.admin.createUser({ email: email.data, password: password.data, email_confirm: true });
  if (error || !created.user) {
    return { ok: false, message: error?.code === "email_exists" ? "That email already has an account. Use a different email." : "Couldn't create the login. Please try again." };
  }
  const { error: insertError } = await ctx.svc.from("admin_users").insert({ email: email.data });
  if (insertError) {
    await ctx.svc.auth.admin.deleteUser(created.user.id); // never leave a login that can't be managed
    return { ok: false, message: "Couldn't save. Nothing was changed." };
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: `${email.data} can now log in.`, credentials: { email: email.data, password: password.data } };
}

export async function resetAdminPassword(input: { email: string; password: string }): Promise<AdminUserResult> {
  const ctx = await requireOwner();
  if (!ctx) return { ok: false, message: "Only the owner can reset someone's password." };
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, message: email.error.issues[0].message };
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, message: password.error.issues[0].message };

  const { data: row } = await ctx.svc.from("admin_users").select("email").eq("email", email.data).maybeSingle();
  if (!row) return { ok: false, message: "That person isn't on your admin list." };
  const id = await findUserId(ctx.svc, email.data);
  if (!id) return { ok: false, message: "Couldn't find that login. Remove them and add them again." };
  const { error } = await ctx.svc.auth.admin.updateUserById(id, { password: password.data });
  if (error) return { ok: false, message: "Couldn't reset the password. Please try again." };
  return { ok: true, message: "Password reset.", credentials: { email: email.data, password: password.data } };
}

export async function removeAdminUser(emailInput: string): Promise<AdminUserResult> {
  const ctx = await requireOwner();
  if (!ctx) return { ok: false, message: "Only the owner can remove admins." };
  const email = emailSchema.safeParse(emailInput);
  if (!email.success) return { ok: false, message: email.error.issues[0].message };
  if (email.data === ctx.owner) return { ok: false, message: "The owner can't be removed." };

  // Access is cut the moment the row is gone (the database checks it on every request)...
  const { error } = await ctx.svc.from("admin_users").delete().eq("email", email.data);
  if (error) return { ok: false, message: "Couldn't remove. Please try again." };
  // ...then the login itself is deleted so the account can't be used for anything.
  const id = await findUserId(ctx.svc, email.data);
  if (id) await ctx.svc.auth.admin.deleteUser(id);
  revalidatePath("/admin/settings");
  return { ok: true, message: `${email.data} was removed.` };
}
