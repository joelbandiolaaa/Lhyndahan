import { z } from "zod";
import { BAKERIES } from "@/lib/types";

const peso = (label: string) =>
  z.coerce
    .number({ error: `Enter the ${label}.` })
    .min(0, `The ${label} can't be negative.`)
    .max(100000, `The ${label} is too large.`)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Up to 2 decimal places only.");

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter the product name.").max(120, "Too long (max 120)."),
  bakery: z.enum(BAKERIES, { error: "Choose a bakery." }),
  category: z.string().trim().min(1, "Enter a category.").max(40, "Too long (max 40)."),
  description: z.string().trim().max(2000, "Too long (max 2000).").default(""),
  // Optional: leave blank until known. null ≠ ₱0.
  supplier_price: peso("supplier price").nullable(),
  selling_price: peso("selling price"),
  delivery_markup: peso("delivery markup"),
  is_active: z.boolean(),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Turns zod issues into { field: "first message" }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "product"}-${suffix}`;
}
