import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. SERVER ONLY — `server-only` makes the
 * build fail if this file is ever imported into browser code.
 * Use only for things the public must do through us (e.g. placing an order).
 */
export function supabaseService() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing environment variable SUPABASE_SECRET_KEY.");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
