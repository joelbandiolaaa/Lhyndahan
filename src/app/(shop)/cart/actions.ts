"use server";

import { z } from "zod";
import { primaryImage, supabasePublic } from "@/lib/shop";
import type { ProductWithImages } from "@/lib/types";

export type FreshLine = { productId: string; slug: string; name: string; price: number; imagePath: string | null };

/** Current name/price/photo for the products in a cart. Hidden or deleted products are left out. */
export async function refreshCart(ids: string[]): Promise<FreshLine[]> {
  const parsed = z.array(z.uuid()).max(60).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) return [];
  const { data } = await supabasePublic()
    .from("products")
    .select("id, slug, name, selling_price, product_images(id, path, sort_order, is_primary)")
    .in("id", parsed.data);
  return ((data ?? []) as unknown as ProductWithImages[]).map((p) => ({
    productId: p.id,
    slug: p.slug,
    name: p.name,
    price: Number(p.selling_price),
    imagePath: primaryImage(p)?.path ?? null,
  }));
}
