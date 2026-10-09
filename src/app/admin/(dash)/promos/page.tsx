import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SITE_BUCKET, publicStorageUrl } from "@/lib/env";
import type { PromoBanner } from "@/lib/promos";
import { PromoManager, type PromoRow } from "./promo-manager";

export const metadata = { title: "Promo banners" };

export default async function PromosPage() {
  const { supabase } = await requireAdmin();
  const [{ data }, { data: cats }, { data: prods }] = await Promise.all([
    supabase.from("promo_banners").select("*").order("sort_order").order("created_at"),
    supabase.from("categories").select("name").order("sort_order").order("created_at"),
    supabase.from("products").select("slug, name").is("deleted_at", null).eq("is_active", true).order("name"),
  ]);
  const rows: PromoRow[] = ((data ?? []) as PromoBanner[]).map((b) => ({
    ...b,
    imageUrl: b.image_path ? publicStorageUrl(SITE_BUCKET, b.image_path) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/settings" className="tap -ml-2 flex min-h-11 items-center gap-0.5 self-start px-2 text-[17px] text-link">
        <ChevronLeft size={20} aria-hidden /> Settings
      </Link>
      <h1 className="font-display text-[34px] leading-tight">Promo banners</h1>
      <p className="-mt-3 text-muted">
        The sliding cards at the top of your shop. Use them for events, reminders and offers. They slide by themselves and customers can swipe.
      </p>
      <PromoManager
        rows={rows}
        options={{ categories: (cats ?? []).map((c) => c.name as string), products: (prods ?? []).map((p) => ({ slug: p.slug as string, name: p.name as string })) }}
      />
    </div>
  );
}
