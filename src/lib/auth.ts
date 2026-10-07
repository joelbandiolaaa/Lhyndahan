import "server-only";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Call at the top of every admin page and action.
 * The database (RLS + is_admin()) is the real lock; this gives a clean
 * redirect instead of empty pages, and stops actions before any work.
 */
export async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/admin/login");

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) redirect("/admin/login?error=not-admin");

  return { supabase, email: String(claims.claims.email ?? "") };
}

/**
 * Re-checks someone's password without touching their session (a throwaway client).
 * Sensitive account changes ask for it again so a stolen/forgotten logged-in phone isn't enough.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!password) return false;
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
