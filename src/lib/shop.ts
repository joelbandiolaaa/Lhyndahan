import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { ProductWithImages } from "@/lib/types";

/** Anonymous client for public storefront reads (RLS: active products only). */
export function supabasePublic() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

export type BatchPreview = { code: string; cutoff_at: string; office_date: string; outside_date: string };

export async function getBatchPreview(): Promise<BatchPreview | null> {
  const { data } = await supabasePublic().rpc("current_batch_preview");
  return (Array.isArray(data) ? data[0] : data) ?? null;
}

export async function getPublicSettings() {
  const { data } = await supabasePublic().rpc("get_public_settings");
  return (Array.isArray(data) ? data[0] : data) as {
    gcash_qr_path: string | null;
    gcash_name: string | null;
    gcash_number: string | null;
  } | null;
}

export type PaymentQr = {
  id: string;
  label: string;
  account_name: string | null;
  account_number: string | null;
  image_path: string;
};

/** Active payment QR codes (RLS lets anyone read the active ones). */
export async function getPaymentQrs(): Promise<PaymentQr[]> {
  const { data } = await supabasePublic()
    .from("payment_qrs")
    .select("id, label, account_name, account_number, image_path")
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as PaymentQr[];
}

export async function getShopProducts(): Promise<ProductWithImages[]> {
  const { data } = await supabasePublic()
    .from("products")
    .select("id, slug, name, bakery, category, description, selling_price, sort_order, product_images(id, path, sort_order, is_primary)")
    .order("sort_order")
    .order("name");
  return (data ?? []) as unknown as ProductWithImages[];
}

export function primaryImage(p: Pick<ProductWithImages, "product_images">) {
  const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return imgs.find((i) => i.is_primary) ?? imgs[0] ?? null;
}

/** Category names in the order the owner arranged them. */
export async function getCategoryOrder(): Promise<string[]> {
  const { data } = await supabasePublic().from("categories").select("name").order("sort_order").order("created_at");
  return (data ?? []).map((c) => c.name as string);
}

/** Groups by category, following `order`; empty categories are skipped. */
export function groupByCategory<T extends { category: string }>(items: T[], order: string[] = []) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  const rank = (name: string) => {
    const i = order.indexOf(name);
    return i === -1 ? order.length : i;
  };
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Received",
  ordered: "Ordered from supplier",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
