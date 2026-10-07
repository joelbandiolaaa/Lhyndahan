import { createHash } from "node:crypto";
import { orderSchema, type OrderResult } from "@/lib/order-schema";
import { supabasePublic } from "@/lib/shop";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  rate_limited: "Too many orders from this device. Please try again in an hour, or message us.",
  product_unavailable: "An item in your cart is no longer available. Go back to your cart to update it.",
  empty_cart: "Your cart is empty.",
  invalid_phone: "Enter a valid mobile number, e.g. 0917 123 4567.",
  invalid_name: "Enter your name.",
  invalid_address: "Enter your full address.",
  invalid_landmark: "Enter a landmark.",
  invalid_map_url: "The Google Maps link isn't valid.",
  invalid_qty: "A quantity in your cart isn't valid.",
};

function fail(message: string, status = 400, fieldErrors?: Record<string, string>) {
  return Response.json({ ok: false, message, fieldErrors }, { status });
}

export async function POST(req: Request) {
  const secret = process.env.ORDER_API_SECRET;
  if (!secret) return fail("Ordering isn't set up yet. Please message us.", 503);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Something went wrong with the request. Refresh the page and try again.");
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    if (fieldErrors.website) return Response.json({ ok: true, code: "LH-0000" }); // bot: pretend success
    return fail("Something is missing or incorrect. Please check the fields in red.", 400, fieldErrors);
  }
  const order: Partial<typeof parsed.data> = { ...parsed.data };
  delete order.website;

  // Hash the IP so we never store it; used only for the per-hour limit.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${secret}:${ip}`).digest("hex");

  const { data, error } = await supabasePublic().rpc("create_order", { p: order, p_ip_hash: ipHash, p_secret: secret });
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    if (key) return fail(MESSAGES[key], key === "rate_limited" ? 429 : 400);
    console.error("create_order failed", error.message);
    return fail("Couldn't place your order. Please try again, or message us.", 500);
  }

  return Response.json({ ok: true, ...(data as OrderResult) });
}
