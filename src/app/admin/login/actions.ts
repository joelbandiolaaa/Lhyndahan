"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = { message?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: "Wrong email or password. Please try again." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { message: "This account doesn't have admin access." };
  }

  redirect("/admin");
}

export async function logout() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
