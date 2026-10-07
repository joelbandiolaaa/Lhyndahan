import "server-only";

import { redirect } from "next/navigation";
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
