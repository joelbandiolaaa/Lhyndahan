"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Browser client. Uses the logged-in user's session; RLS applies. */
export function supabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
