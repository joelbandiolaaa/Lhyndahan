import { cleanSearch, STATUS_LABELS, type AdminOrder } from "@/lib/admin";
import { paymentShortLabel } from "@/lib/payment";
import { formatPhone } from "@/lib/phone";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Excel-safe CSV cell: quote everything, double inner quotes, block formula injection. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function manila(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso)).replace(",", "");
}

/**
 * GET /admin/orders/export?batch=…&status=…  → orders.csv
 * Same filters as the Orders page. Opens in Excel and Google Sheets.
 */
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(req.url).searchParams;
  let query = supabase
    .from("orders")
    .select("code, created_at, name, phone, delivery_type, delivery_date, address, landmark, map_url, notes, payment_method, qr_provider, paid, status, total, batch_id, order_items(product_name, qty, selling_price, supplier_price, delivery_markup), batches(code)")
    .order("created_at", { ascending: true })
    .limit(5000);
  const batch = sp.get("batch");
  const batchIds = (sp.get("batches") ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 10);
  if (batch && /^[0-9a-f-]{36}$/i.test(batch)) query = query.eq("batch_id", batch);
  else if (batchIds.length) query = query.in("batch_id", batchIds);
  const status = sp.get("status");
  if (status && Object.hasOwn(STATUS_LABELS, status)) query = query.eq("status", status);
  if (sp.get("paid") === "paid") query = query.eq("paid", true);
  if (sp.get("paid") === "unpaid") query = query.eq("paid", false);
  const delivery = sp.get("delivery");
  if (delivery === "office" || delivery === "outside") query = query.eq("delivery_type", delivery);
  const pay = sp.get("pay");
  if (pay === "cod") query = query.eq("payment_method", "cod");
  if (pay === "qr") query = query.in("payment_method", ["qr", "gcash"]);
  const q = cleanSearch(sp.get("q") ?? "");
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return new Response("Export failed", { status: 500 });

  type Row = Omit<AdminOrder, "order_items"> & {
    batches: { code: string } | null;
    order_items: { product_name: string; qty: number; selling_price: number; supplier_price: number | null; delivery_markup: number }[];
  };
  const rows = (data ?? []) as unknown as Row[];

  const header = [
    "Order No", "Date (Manila)", "Batch (cutoff)", "Name", "Phone", "Delivery", "Delivery date",
    "Address", "Landmark", "Google Maps", "Items", "Pieces", "Total", "Payment", "Paid?", "Status",
    "Supplier cost", "Profit", "Notes",
  ];
  const lines = [header.map(cell).join(",")];
  for (const o of rows) {
    const pieces = o.order_items.reduce((n, i) => n + i.qty, 0);
    const known = o.order_items.every((i) => i.supplier_price !== null);
    const cost = o.order_items.reduce((n, i) => n + Number(i.supplier_price ?? 0) * i.qty, 0);
    const profit = o.order_items.reduce((n, i) => n + (Number(i.selling_price) - Number(i.delivery_markup) - Number(i.supplier_price ?? 0)) * i.qty, 0);
    lines.push(
      [
        o.code, manila(o.created_at), o.batches?.code ?? "", o.name, formatPhone(o.phone),
        o.delivery_type === "office" ? "KUS" : "My address", o.delivery_date, o.address, o.landmark, o.map_url ?? "",
        o.order_items.map((i) => `${i.qty}x ${i.product_name}`).join("; "), pieces, Number(o.total),
        paymentShortLabel(o.payment_method, o.qr_provider), o.paid ? "Paid" : "Unpaid", STATUS_LABELS[o.status],
        known ? cost : "", known ? profit : "", o.notes ?? "",
      ].map(cell).join(","),
    );
  }

  // BOM so Excel reads ₱, ñ and accents correctly.
  const csv = "﻿" + lines.join("\r\n");
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lhyndahan-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
