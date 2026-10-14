import ExcelJS from "exceljs";
import { batchContext, type Batch } from "@/lib/admin";
import { formatDay } from "@/lib/dates";
import { paymentShortLabel } from "@/lib/payment";
import { formatPhone } from "@/lib/phone";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PINK = "FFE9082F";
const PESO = '"₱"#,##0.00';

type SummaryRow = { product_name: string; qty: number };
type OrderRow = {
  code: string;
  name: string;
  phone: string;
  delivery_type: "office" | "outside";
  delivery_date: string;
  address: string;
  landmark: string;
  notes: string | null;
  payment_method: "cod" | "qr" | "gcash";
  qr_provider: string | null;
  paid: boolean;
  status: string;
  total: number;
  order_items: { product_name: string; qty: number }[];
};

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PINK } };
  });
  row.height = 22;
}

/**
 * GET /admin/batch/export?batch=… → one .xlsx with two tabs:
 *   "Supplier order": how many of each product (give this to the supplier; no prices, no customers)
 *   "Per customer":   one row per order (for you: who ordered what, where, and whether it's paid)
 * Both tabs count only ?s=pending,ordered,delivered (default pending,ordered); cancelled orders are never included.
 * ?orders=id1,id2,… builds both tabs for just those orders (the custom batch picked on the Orders page).
 */
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(req.url).searchParams;
  // Custom selection: ?orders=id1,id2,… → a supplier sheet and customer sheet for exactly those orders.
  const customIds = (sp.get("orders") ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  const counted = (sp.get("s") ?? "").split(",").filter((x) => ["pending", "ordered", "delivered"].includes(x));
  const statuses = counted.length > 0 ? counted : ["pending", "ordered"];

  const ORDER_COLS = "code, name, phone, delivery_type, delivery_date, address, landmark, notes, payment_method, qr_provider, paid, status, total, order_items(product_name, qty)";
  let batch: Batch | null = null;
  let items: { product: string; qty: number }[];
  let orders: OrderRow[];

  if (customIds.length > 0) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLS)
      .in("id", customIds)
      .neq("status", "cancelled")
      .order("delivery_type", { ascending: false })
      .order("name", { ascending: true });
    if (error) return new Response("Export failed", { status: 500 });
    orders = (data ?? []) as unknown as OrderRow[];
    const totals = new Map<string, number>();
    for (const o of orders) for (const it of o.order_items) totals.set(it.product_name, (totals.get(it.product_name) ?? 0) + it.qty);
    items = [...totals.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([product, qty]) => ({ product, qty }));
  } else {
    const { data: batchRows } = await supabase.from("batches").select("*").order("cutoff_at", { ascending: false }).limit(26);
    const batches = (batchRows ?? []) as Batch[];
    const { current, lastClosed, recentlyClosed } = batchContext(batches);
    const wanted = sp.get("batch");
    batch = batches.find((b) => b.id === wanted) ?? recentlyClosed ?? current ?? lastClosed ?? null;
    if (!batch) return new Response("No batch yet", { status: 404 });

    const [{ data: summary, error: e1 }, { data: orderData, error: e2 }] = await Promise.all([
      supabase.rpc("batch_summary_by_status", { p_batch_id: batch.id, p_statuses: statuses }),
      supabase
        .from("orders")
        .select(ORDER_COLS)
        .eq("batch_id", batch.id)
        .in("status", statuses)
        .order("delivery_type", { ascending: false }) // "office" (KUS) before "outside"
        .order("name", { ascending: true })
        .limit(2000),
    ]);
    if (e1 || e2) return new Response("Export failed", { status: 500 });
    items = ((summary ?? []) as SummaryRow[]).map((r) => ({ product: r.product_name, qty: Number(r.qty) }));
    orders = (orderData ?? []) as unknown as OrderRow[];
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lhyndahan";
  wb.created = new Date();

  // ---- Tab 1: Supplier order ----
  const s1 = wb.addWorksheet("Supplier order", { views: [{ state: "frozen", ySplit: 4 }] });
  s1.columns = [{ width: 44 }, { width: 12 }];
  s1.getCell("A1").value = batch ? `Order for ${formatDay(batch.office_date)} (KUS) and ${formatDay(batch.outside_date)}` : `Custom order · ${orders.length} selected order${orders.length === 1 ? "" : "s"}`;
  s1.getCell("A1").font = { bold: true, size: 14 };
  s1.getCell("A2").value = batch
    ? `Batch ${batch.code} · ${orders.length} order${orders.length === 1 ? "" : "s"} · counting:  ${statuses.join(", ")}`
    : "Only the orders you selected";
  s1.getCell("A2").font = { color: { argb: "FF707070" } };
  const h1 = s1.getRow(4);
  h1.values = ["Product", "Qty"];
  styleHeader(h1);
  h1.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
  items.forEach((it, i) => {
    const r = s1.getRow(5 + i);
    r.values = [it.product, it.qty];
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(2).font = { bold: true };
    r.border = { bottom: { style: "hair", color: { argb: "FFBBBBBB" } } };
  });
  const totalRow = s1.getRow(5 + items.length);
  totalRow.values = ["TOTAL PIECES", items.reduce((n, i) => n + i.qty, 0)];
  totalRow.font = { bold: true };
  totalRow.getCell(2).alignment = { horizontal: "right" };
  totalRow.border = { top: { style: "thin" } };
  if (items.length === 0) s1.getCell("A5").value = "No orders in this batch yet.";

  // ---- Tab 2: Per customer ----
  const s2 = wb.addWorksheet("Per customer", { views: [{ state: "frozen", ySplit: 1 }] });
  s2.columns = [
    { header: "#", width: 5 },
    { header: "Order no.", width: 11 },
    { header: "Customer", width: 24 },
    { header: "Phone", width: 15 },
    { header: "Delivery", width: 13 },
    { header: "Date", width: 17 },
    { header: "What they ordered", width: 40 },
    { header: "Pcs", width: 6 },
    { header: "Total", width: 13 },
    { header: "Payment", width: 16 },
    { header: "Paid?", width: 9 },
    { header: "Address", width: 40 },
    { header: "Notes", width: 28 },
  ];
  styleHeader(s2.getRow(1));
  orders.forEach((o, i) => {
    const r = s2.addRow([
      i + 1,
      o.code,
      o.name,
      formatPhone(o.phone),
      o.delivery_type === "office" ? "KUS" : "My address",
      formatDay(o.delivery_date),
      o.order_items.map((it) => `${it.qty} × ${it.product_name}`).join("\n"),
      o.order_items.reduce((n, it) => n + it.qty, 0),
      Number(o.total),
      paymentShortLabel(o.payment_method, o.qr_provider),
      o.paid ? "Paid" : "Unpaid",
      o.delivery_type === "outside" ? [o.address, o.landmark && `Landmark: ${o.landmark}`].filter(Boolean).join("\n") : "",
      o.notes ?? "",
    ]);
    r.alignment = { vertical: "top", wrapText: true };
    r.getCell(9).numFmt = PESO;
    r.getCell(4).numFmt = "@"; // keep the leading 0 of the phone number
    if (!o.paid) r.getCell(11).font = { color: { argb: "FFB45309" }, bold: true };
    r.border = { bottom: { style: "hair", color: { argb: "FFBBBBBB" } } };
  });
  const sum = (f: (o: OrderRow) => boolean) => orders.filter(f).reduce((n, o) => n + Number(o.total), 0);
  s2.addRow([]);
  const t1 = s2.addRow(["", "", "", "", "", "", "All orders", orders.reduce((n, o) => n + o.order_items.reduce((m, i) => m + i.qty, 0), 0), sum(() => true)]);
  const t2 = s2.addRow(["", "", "", "", "", "", "Still unpaid", "", sum((o) => !o.paid)]);
  const t3 = s2.addRow(["", "", "", "", "", "", "Collect at the door (unpaid COD)", "", sum((o) => !o.paid && o.payment_method === "cod")]);
  for (const t of [t1, t2, t3]) {
    t.font = { bold: true };
    t.getCell(9).numFmt = PESO;
  }
  s2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };
  s2.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lhyndahan-${batch ? `batch-${batch.code}` : "custom"}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
