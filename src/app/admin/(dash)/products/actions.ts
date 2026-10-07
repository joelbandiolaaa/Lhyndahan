"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_BUCKET } from "@/lib/env";
import type { ActionResult, ProductImage } from "@/lib/types";
import { fieldErrors, productSchema, slugify, type ProductInput } from "@/lib/validators";

const uuid = z.uuid();

function refresh(productId?: string) {
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout"); // storefront
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await supabase
    .from("products")
    .insert({ ...parsed.data, slug: slugify(parsed.data.name) })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.code === "23503" ? "That category no longer exists. Pick another." : "Couldn't save. Please try again." };

  refresh();
  redirect(`/admin/products/${data.id}?created=1`);
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid product." };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };

  // Slug is kept on purpose so links already shared on Facebook keep working.
  const { error } = await supabase.from("products").update(parsed.data).eq("id", id);
  if (error) return { ok: false, message: error.code === "23503" ? "That category no longer exists. Pick another." : "Couldn't save. Please try again." };

  refresh(id);
  return { ok: true, message: "Saved." };
}

export async function setProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid product." };
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't update. Please try again." };
  refresh(id);
  return { ok: true };
}

/**
 * "Delete" hides the product and removes it from the list, but keeps the row
 * so past orders still point to it. Images stay in storage for the same reason.
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid product." };
  const { error } = await supabase
    .from("products")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete. Please try again." };
  refresh(id);
  redirect("/admin/products?deleted=1");
}

// ---------------------------------------------------------------- images

async function listImages(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], productId: string) {
  const { data } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as ProductImage[];
}

/** Called after the browser uploaded the file straight to Supabase Storage. */
export async function addProductImage(productId: string, path: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
  if (!path.startsWith(`${productId}/`) || path.includes("..")) return { ok: false, message: "Invalid image path." };

  const existing = await listImages(supabase, productId);
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    path,
    sort_order: existing.length ? Math.max(...existing.map((i) => i.sort_order)) + 1 : 0,
    is_primary: !existing.some((i) => i.is_primary),
  });
  if (error) return { ok: false, message: "Uploaded but couldn't be saved. Please try again." };
  refresh(productId);
  return { ok: true };
}

export async function moveProductImage(imageId: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(imageId).success) return { ok: false, message: "Invalid image." };

  const { data: img } = await supabase.from("product_images").select("product_id").eq("id", imageId).single();
  if (!img) return { ok: false, message: "Image not found." };

  const images = await listImages(supabase, img.product_id);
  const from = images.findIndex((i) => i.id === imageId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= images.length) return { ok: true };

  [images[from], images[to]] = [images[to], images[from]];
  // Renumber everything 0..n so order is always clean.
  const results = await Promise.all(
    images.map((i, idx) => supabase.from("product_images").update({ sort_order: idx }).eq("id", i.id)),
  );
  if (results.some((r) => r.error)) return { ok: false, message: "Couldn't reorder. Please try again." };
  refresh(img.product_id);
  return { ok: true };
}

export async function setPrimaryImage(imageId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(imageId).success) return { ok: false, message: "Invalid image." };

  const { data: img } = await supabase.from("product_images").select("product_id").eq("id", imageId).single();
  if (!img) return { ok: false, message: "Image not found." };

  // Clear first: the database allows only one primary per product.
  const clear = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", img.product_id);
  const set = await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId);
  if (clear.error || set.error) return { ok: false, message: "Couldn't set the main photo. Please try again." };
  refresh(img.product_id);
  return { ok: true };
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(imageId).success) return { ok: false, message: "Invalid image." };

  const { data: img } = await supabase.from("product_images").select("*").eq("id", imageId).single();
  if (!img) return { ok: true };

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { ok: false, message: "Couldn't delete. Please try again." };
  await supabase.storage.from(PRODUCT_BUCKET).remove([img.path]);

  if (img.is_primary) {
    const [next] = await listImages(supabase, img.product_id);
    if (next) await supabase.from("product_images").update({ is_primary: true }).eq("id", next.id);
  }
  refresh(img.product_id);
  return { ok: true };
}
