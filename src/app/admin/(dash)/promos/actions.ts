"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { fromManilaInput } from "@/lib/dates";
import { SITE_BUCKET } from "@/lib/env";
import { PROMO_BG_KEYS } from "@/lib/promos";
import type { ActionResult } from "@/lib/types";

const uuid = z.uuid();
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} is too long (max ${max}).`).transform((v) => (v === "" ? null : v));

const promoSchema = z
  .object({
    badge: optionalText(24, "The label"),
    headline: optionalText(60, "The headline"),
    subtext: optionalText(140, "The text"),
    bg: z.enum(PROMO_BG_KEYS as [string, ...string[]], { error: "Choose a colour." }),
    link_kind: z.enum(["none", "category", "product"]),
    link_value: z.string().trim().max(120),
    starts_at: z.string().trim(),
    ends_at: z.string().trim(),
    is_active: z.boolean(),
    image_path: z
      .string()
      .max(200)
      .nullable()
      .refine((p) => p === null || (p.startsWith("banners/") && !p.includes("..")), "Invalid image."),
  })
  .superRefine((v, ctx) => {
    if (!v.headline && !v.image_path) ctx.addIssue({ code: "custom", path: ["headline"], message: "Add a headline or a picture." });
    if (v.link_kind !== "none" && !v.link_value) ctx.addIssue({ code: "custom", path: ["link_value"], message: "Choose where the banner should go." });
    if (v.starts_at && !fromManilaInput(v.starts_at)) ctx.addIssue({ code: "custom", path: ["starts_at"], message: "Enter a valid date and time." });
    if (v.ends_at && !fromManilaInput(v.ends_at)) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Enter a valid date and time." });
    const s = fromManilaInput(v.starts_at);
    const e = fromManilaInput(v.ends_at);
    if (s && e && new Date(e) <= new Date(s)) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end must be after the start." });
  });

export type PromoInput = z.input<typeof promoSchema>;

function refresh() {
  revalidatePath("/admin/promos");
  revalidatePath("/", "layout"); // storefront
}

function fieldErrors(error: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of error.issues) fe[String(i.path[0])] ??= i.message;
  return fe;
}

/** Checks the link really points somewhere, so a banner can never lead to a dead page. */
async function linkIsValid(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], kind: string, value: string) {
  if (kind === "none") return true;
  if (kind === "category") {
    const { data } = await supabase.from("categories").select("id").eq("name", value).maybeSingle();
    return !!data;
  }
  const { data } = await supabase.from("products").select("id").eq("slug", value).is("deleted_at", null).maybeSingle();
  return !!data;
}

function toRow(p: z.output<typeof promoSchema>) {
  return {
    badge: p.badge,
    headline: p.headline,
    subtext: p.subtext,
    image_path: p.image_path,
    bg: p.bg,
    link_kind: p.link_kind,
    link_value: p.link_kind === "none" ? null : p.link_value,
    starts_at: fromManilaInput(p.starts_at),
    ends_at: fromManilaInput(p.ends_at),
    is_active: p.is_active,
  };
}

export async function createPromo(input: PromoInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
  if (!(await linkIsValid(supabase, parsed.data.link_kind, parsed.data.link_value)))
    return { ok: false, message: "Please check the form.", fieldErrors: { link_value: "That category or product no longer exists." } };

  const { count } = await supabase.from("promo_banners").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 12) return { ok: false, message: "That's a lot of banners already (max 12). Delete an old one first." };

  const { data: last } = await supabase.from("promo_banners").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("promo_banners").insert({ ...toRow(parsed.data), sort_order: (last?.[0]?.sort_order ?? -1) + 1 });
  if (error) {
    if (parsed.data.image_path) await supabase.storage.from(SITE_BUCKET).remove([parsed.data.image_path]);
    return { ok: false, message: "Couldn't save. Please try again." };
  }
  refresh();
  return { ok: true, message: "Banner added." };
}

export async function updatePromo(id: string, input: PromoInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid banner." };
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
  if (!(await linkIsValid(supabase, parsed.data.link_kind, parsed.data.link_value)))
    return { ok: false, message: "Please check the form.", fieldErrors: { link_value: "That category or product no longer exists." } };

  const { data: before } = await supabase.from("promo_banners").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("promo_banners").update(toRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  // A replaced or removed picture no longer needs its file.
  if (before?.image_path && before.image_path !== parsed.data.image_path) await supabase.storage.from(SITE_BUCKET).remove([before.image_path]);
  refresh();
  return { ok: true, message: "Saved." };
}

export async function setPromoActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid banner." };
  const { error } = await supabase.from("promo_banners").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't update. Please try again." };
  refresh();
  return { ok: true, message: active ? "Banner is showing." : "Banner hidden." };
}

export async function movePromo(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid banner." };
  const { data } = await supabase.from("promo_banners").select("id").order("sort_order").order("created_at");
  const ids = (data ?? []).map((b) => b.id as string);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const results = await Promise.all(ids.map((bid, idx) => supabase.from("promo_banners").update({ sort_order: idx }).eq("id", bid)));
  if (results.some((r) => r.error)) return { ok: false, message: "Couldn't reorder. Please try again." };
  refresh();
  return { ok: true };
}

export async function deletePromo(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid banner." };
  const { data: row } = await supabase.from("promo_banners").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("promo_banners").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete. Please try again." };
  if (row?.image_path) await supabase.storage.from(SITE_BUCKET).remove([row.image_path]);
  refresh();
  return { ok: true, message: "Banner deleted." };
}
