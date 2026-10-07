"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

const uuid = z.uuid();
const nameSchema = z.string().trim().min(1, "Enter a category name.").max(40, "Too long (max 40).");

function refresh() {
  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout"); // storefront
}

export async function addCategory(name: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { data: last } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("categories").insert({ name: parsed.data, sort_order: (last?.[0]?.sort_order ?? -1) + 1 });
  if (error) return { ok: false, message: error.code === "23505" ? "You already have that category." : "Couldn't add. Please try again." };
  refresh();
  return { ok: true, message: `${parsed.data} added.` };
}

/** Renaming also renames it on every product in it (the database follows along). */
export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid category." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { error } = await supabase.from("categories").update({ name: parsed.data }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "You already have that category." : "Couldn't save. Please try again." };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid category." };

  const { data } = await supabase.from("categories").select("id").order("sort_order").order("created_at");
  const ids = (data ?? []).map((c) => c.id as string);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return { ok: true };

  [ids[from], ids[to]] = [ids[to], ids[from]];
  const results = await Promise.all(ids.map((cid, idx) => supabase.from("categories").update({ sort_order: idx }).eq("id", cid)));
  if (results.some((r) => r.error)) return { ok: false, message: "Couldn't reorder. Please try again." };
  refresh();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid category." };

  const { data: cat } = await supabase.from("categories").select("name").eq("id", id).maybeSingle();
  if (!cat) return { ok: true };
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category", cat.name).is("deleted_at", null);
  if (count) return { ok: false, message: `${cat.name} still has ${count} product(s). Move them to another category first.` };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete. It may still be used by a removed product." };
  refresh();
  return { ok: true, message: `${cat.name} deleted.` };
}
