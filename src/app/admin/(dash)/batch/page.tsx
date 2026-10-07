import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, Notice } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { batchContext, type Batch } from "@/lib/admin";
import { formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { BatchPicker } from "../batch-picker";
import { SupplierTools } from "./supplier-tools";

export const metadata = { title: "Batch summary" };

type Row = { product_name: string; qty: number; supplier_price: number | null; supplier_cost: number | null; sales: number };

export default async function BatchPage(props: PageProps<"/admin/batch">) {
  const sp = await props.searchParams;
  const { supabase } = await requireAdmin();

  const { data: batchRows } = await supabase.from("batches").select("*").order("cutoff_at", { ascending: false }).limit(26);
  const batches = (batchRows ?? []) as Batch[];
  const { current, lastClosed, recentlyClosed, isOpen: open } = batchContext(batches);
  const wanted = typeof sp.batch === "string" ? sp.batch : undefined;
  const batch = batches.find((b) => b.id === wanted) ?? recentlyClosed ?? current ?? lastClosed ?? null;

  if (!batch) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-[34px] leading-tight">Batch summary</h1>
        <EmptyState title="No batches yet" body="Your batch will show up here once the first order comes in." />
      </div>
    );
  }

  const [{ data: rows }, { count: pendingCount }, { count: orderCount }] = await Promise.all([
    supabase.rpc("batch_summary", { p_batch_id: batch.id }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).neq("status", "cancelled"),
  ]);
  const items = ((rows ?? []) as Row[]).map((r) => ({ ...r, qty: Number(r.qty) }));
  const pieces = items.reduce((n, r) => n + r.qty, 0);
  const knownCost = items.reduce((n, r) => n + Number(r.supplier_cost ?? 0), 0);
  const missing = items.filter((r) => r.supplier_price === null).length;

  const supplierText = [
    `Hi! Order for ${formatDay(batch.office_date)}:`,
    "",
    ...items.map((r) => `${r.product_name} x ${r.qty}`),
    "",
    `Total: ${pieces} pcs`,
    "Thank you!",
  ].join("\n");

  const isOpen = open(batch);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[34px] leading-tight">Batch summary</h1>
        <div className="flex flex-wrap items-center gap-2">
          <BatchPicker batches={batches} value={batch.id} currentId={current?.id ?? null} />
          <a href={`/admin/batch/export?batch=${batch.id}`} className={buttonClass("secondary", "md")}>
            <Download size={18} aria-hidden /> Download Excel
          </a>
        </div>
      </div>
      <p className="-mt-2 text-[15px] text-muted">
        Delivery {formatDay(batch.office_date)} (KUS) and {formatDay(batch.outside_date)} (My address)
        {isOpen ? " · orders still open, more can be added" : ""}
      </p>

      {batch.supplier_ordered_at ? <Notice tone="success">This batch has been ordered from the supplier.</Notice> : null}

      {items.length === 0 ? (
        <EmptyState title="No orders in this batch yet" />
      ) : (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="px-4 pt-4 pb-2 font-medium">Product</th>
                  <th className="px-4 pt-4 pb-2 text-right font-medium">Qty</th>
                  <th className="px-4 pt-4 pb-2 text-right font-medium">Supplier cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {items.map((r) => (
                  <tr key={r.product_name}>
                    <td className="px-4 py-2.5">{r.product_name}</td>
                    <td className="num px-4 py-2.5 text-right font-semibold">{r.qty}</td>
                    <td className="num px-4 py-2.5 text-right text-muted">
                      {r.supplier_cost === null ? <span className="text-warning">—</span> : formatPeso(r.supplier_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/[0.08] font-semibold">
                  <td className="px-4 py-3">{orderCount ?? 0} order(s)</td>
                  <td className="num px-4 py-3 text-right">{pieces}</td>
                  <td className="num px-4 py-3 text-right">{formatPeso(knownCost)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
          {missing > 0 ? (
            <p className="-mt-2 text-[13px] text-warning">
              {missing} product(s) have no supplier price, so the supplier cost is incomplete.
            </p>
          ) : null}
          <SupplierTools text={supplierText} batchId={batch.id} pendingCount={pendingCount ?? 0} />
        </>
      )}
    </div>
  );
}
