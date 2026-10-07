import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

/** Required only for "outside" delivery; KUS orders are delivered on-site and skip these. */
export const addressField = z.string().trim().min(5, "Enter your full address (building/unit, street, barangay).").max(300, "Too long.");
export const landmarkField = z.string().trim().min(2, "Enter a landmark, e.g. beside 7-Eleven.").max(200, "Too long.");

/** Shared by the checkout form (client) and /api/orders (server). */
export const orderSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Name is too long."),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 0917 123 4567." });
        return z.NEVER;
      }
      return n;
    }),
  delivery_type: z.enum(["office", "outside"], { error: "Choose how you want it delivered." }),
  address: z.string().trim().max(300, "Too long.").optional().default(""),
  landmark: z.string().trim().max(200, "Too long.").optional().default(""),
  map_url: z
    .string()
    .trim()
    .max(500, "Link is too long.")
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Link must start with https://")
    .optional()
    .default(""),
  notes: z.string().trim().max(500, "Up to 500 characters only.").optional().default(""),
  payment_method: z.enum(["cod", "qr"], { error: "Choose a payment method." }),
  qr_id: z.string().trim().optional().default(""),
  items: z
    .array(z.object({ product_id: z.uuid(), qty: z.number().int().min(1).max(99) }))
    .min(1, "Your cart is empty.")
    .max(40, "Too many items."),
  website: z.string().max(0).optional().default(""), // honeypot: real people leave it empty
}).superRefine((v, ctx) => {
  if (v.payment_method === "qr" && !z.uuid().safeParse(v.qr_id).success) {
    ctx.addIssue({ code: "custom", path: ["qr_id"], message: "Choose where you'll pay (GCash, Maya, bank...)." });
  }
  if (v.delivery_type !== "outside") return;
  for (const [key, field] of [["address", addressField], ["landmark", landmarkField]] as const) {
    const r = field.safeParse(v[key]);
    if (!r.success) ctx.addIssue({ code: "custom", path: [key], message: r.error.issues[0].message });
  }
});

export type OrderInput = z.input<typeof orderSchema>;

export type OrderResult = {
  code: string;
  total: number;
  delivery_date: string;
  delivery_type: "office" | "outside";
  payment_method: "cod" | "qr";
  qr_provider?: string | null;
};
