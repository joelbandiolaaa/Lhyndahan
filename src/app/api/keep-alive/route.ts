import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Free Supabase projects pause after 7 days with no activity. Vercel Cron
 * calls this once a day (see vercel.json) with a tiny read, so the database
 * never goes to sleep, even during weeks with no orders.
 * Uses the public key: it reads only what any visitor can already see.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from("products").select("id").limit(1);
  return Response.json(
    { ok: !error, at: new Date().toISOString() },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
