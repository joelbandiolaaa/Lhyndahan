import ExcelJS from "exceljs";
import { paymentShortLabel } from "@/lib/payment";
import { formatPhone } from "@/lib/phone";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PINK = "FFD70F64";
const PESO = '"₱"#,##0.00';
const PAGE = 1000;

type Row = Record<string, unknown>;
type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** Reads a whole table, 1000 rows at a time (the API caps a single request). */
async function fetchAll(db: Db, table: string, select: string, order: string): Promise<Row[] | null> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(select).order(order, { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) return null;
    out.push(...((data ?? []) as unknown as Row[]));
    if ((data ?? []).length < PAGE) return out;
  }
}

function manila(iso: unknown) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(String(iso))).replace(",", "");
}

type Col = { header: string; width: number; value: (r: Row) => string | number | boolean | null; fmt?: string };

function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Row[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PINK } }; });
  head.height = 22;
  for (const r of rows) {
    const row = ws.addRow(cols.map((c) => c.value(r)));
    cols.forEach((c, i) => { if (c.fmt) row.getCell(i + 1).numFmt = c.fmt; });
    row.alignment = { vertical: "top", wrapText: true };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
}

const s = (k: string) => (r: Row) => (r[k] == null ? "" : String(r[k]));
const n = (k: string) => (r: Row) => (r[k] == null ? null : Number(r[k]));
const yn = (k: string) => (r: Row) => (r[k] ? "Yes" : "No");
const t = (k: string) => (r: Row) => manila(r[k]);

/**
 * GET /admin/backup/export → one .xlsx with EVERYTHING (all batches, cancelled orders included):
 * Orders, Order items, Customers, Products, Categories, Batches, Payment QRs.
 * It's a safety copy of the database, so nothing is filtered out.
 */
export async function GET() {
  const db = await supabaseServer();
  const { data: isAdmin } = await db.rpc("is_admin");
  if (!isAdmin) return new Response("Unauthorized", { status: 401 });

  const [orders, items, customers, products, categories, batches, qrs] = await Promise.all([
    fetchAll(db, "orders", "id, code, created_at, batch_id, status, name, phone, delivery_type, delivery_date, address, landmark, map_url, notes, payment_method, qr_provider, paid, paid_at, ordered_at, delivered_at, cancelled_at, total", "created_at"),
    fetchAll(db, "order_items", "id, order_id, product_name, qty, selling_price, supplier_price, delivery_markup", "id"),
    fetchAll(db, "customers", "id, name, phone, created_at", "created_at"),
    fetchAll(db, "products", "id, name, slug, bakery, category, description, supplier_price, selling_price, delivery_markup, is_active, deleted_at, sort_order, created_at", "sort_order"),
    fetchAll(db, "categories", "id, name, sort_order", "sort_order"),
    fetchAll(db, "batches", "id, code, starts_at, cutoff_at, office_date, outside_date, supplier_ordered_at", "starts_at"),
    fetchAll(db, "payment_qrs", "id, label, account_name, account_number, is_active, sort_order", "sort_order"),
  ]);
  // A backup that silently misses a table is worse than none, so fail loudly.
  if (!orders || !items || !customers || !products || !categories || !batches || !qrs) return new Response("Backup failed. Please try again.", { status: 500 });

  const batchCode = new Map(batches.map((b) => [b.id, String(b.code)]));
  const orderCode = new Map(orders.map((o) => [o.id, String(o.code)]));
  const orderCount = new Map<string, number>();
  for (const o of orders) orderCount.set(String(o.phone), (orderCount.get(String(o.phone)) ?? 0) + 1);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lhyndahan";
  wb.created = new Date();

  addSheet(wb, "Orders", [
    { header: "Order no.", width: 11, value: s("code") },
    { header: "Placed (Manila)", width: 17, value: t("created_at") },
    { header: "Batch", width: 12, value: (r) => batchCode.get(r.batch_id) ?? "" },
    { header: "Status", width: 11, value: s("status") },
    { header: "Customer", width: 24, value: s("name") },
    { header: "Phone", width: 15, value: (r) => formatPhone(String(r.phone)), fmt: "@" },
    { header: "Delivery", width: 12, value: (r) => (r.delivery_type === "office" ? "KUS" : "My address") },
    { header: "Delivery date", width: 13, value: s("delivery_date") },
    { header: "Address", width: 36, value: s("address") },
    { header: "Landmark", width: 24, value: s("landmark") },
    { header: "Map link", width: 24, value: s("map_url") },
    { header: "Notes", width: 28, value: s("notes") },
    { header: "Payment", width: 16, value: (r) => paymentShortLabel(r.payment_method as "cod" | "qr" | "gcash", (r.qr_provider as string | null) ?? null) },
    { header: "Paid?", width: 8, value: yn("paid") },
    { header: "Paid at", width: 17, value: t("paid_at") },
    { header: "Ordered at", width: 17, value: t("ordered_at") },
    { header: "Delivered at", width: 17, value: t("delivered_at") },
    { header: "Cancelled at", width: 17, value: t("cancelled_at") },
    { header: "Total", width: 13, value: n("total"), fmt: PESO },
  ], orders);

  addSheet(wb, "Order items", [
    { header: "Order no.", width: 11, value: (r) => orderCode.get(r.order_id) ?? "" },
    { header: "Product", width: 36, value: s("product_name") },
    { header: "Qty", width: 6, value: n("qty") },
    { header: "Selling price", width: 14, value: n("selling_price"), fmt: PESO },
    { header: "Supplier price", width: 14, value: n("supplier_price"), fmt: PESO },
    { header: "Delivery markup", width: 15, value: n("delivery_markup"), fmt: PESO },
    { header: "Line total", width: 14, value: (r) => Number(r.selling_price) * Number(r.qty), fmt: PESO },
  ], items);

  addSheet(wb, "Customers", [
    { header: "Name", width: 26, value: s("name") },
    { header: "Phone", width: 15, value: (r) => formatPhone(String(r.phone)), fmt: "@" },
    { header: "Orders", width: 8, value: (r) => orderCount.get(String(r.phone)) ?? 0 },
    { header: "First order", width: 17, value: t("created_at") },
  ], customers);

  addSheet(wb, "Products", [
    { header: "Name", width: 34, value: s("name") },
    { header: "Category", width: 16, value: s("category") },
    { header: "Bakery", width: 18, value: s("bakery") },
    { header: "Selling price", width: 14, value: n("selling_price"), fmt: PESO },
    { header: "Supplier price", width: 14, value: n("supplier_price"), fmt: PESO },
    { header: "Delivery markup", width: 15, value: n("delivery_markup"), fmt: PESO },
    { header: "In store?", width: 10, value: (r) => (r.deleted_at ? "Deleted" : r.is_active ? "Live" : "Hidden") },
    { header: "Description", width: 40, value: s("description") },
    { header: "Link name (slug)", width: 28, value: s("slug") },
  ], products);

  addSheet(wb, "Categories", [
    { header: "Order", width: 8, value: (r) => Number(r.sort_order) + 1 },
    { header: "Name", width: 26, value: s("name") },
  ], categories);

  addSheet(wb, "Batches", [
    { header: "Batch", width: 12, value: s("code") },
    { header: "Opened", width: 17, value: t("starts_at") },
    { header: "Closes", width: 17, value: t("cutoff_at") },
    { header: "KUS delivery", width: 14, value: s("office_date") },
    { header: "My address delivery", width: 18, value: s("outside_date") },
    { header: "Sent to supplier", width: 17, value: t("supplier_ordered_at") },
  ], batches);

  addSheet(wb, "Payment QRs", [
    { header: "Name", width: 18, value: s("label") },
    { header: "Account name", width: 24, value: s("account_name") },
    { header: "Account number", width: 20, value: s("account_number"), fmt: "@" },
    { header: "Shown at checkout?", width: 18, value: yn("is_active") },
  ], qrs);

  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lhyndahan-backup-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
