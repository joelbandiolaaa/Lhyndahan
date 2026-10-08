import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, Notice } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { batchContext, hasPassed, type Batch } from "@/lib/admin";
import { formatCutoff, formatDay } from "@/lib/dates";
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

  const isOpen = open(batch);
  const runs: { type: "office" | "outside"; title: string; date: string; closesAt: string; orderedAt: string | null }[] = [
    { type: "office", title: "KUS Delivery", date: batch.office_date, closesAt: batch.office_cutoff_at, orderedAt: batch.office_supplier_ordered_at },
    { type: "outside", title: "My address", date: batch.outside_date, closesAt: batch.cutoff_at, orderedAt: batch.outside_supplier_ordered_at },
  ];
  const data = await Promise.all(
    runs.map(async (r) => {
      const [{ data: rows }, { count: pendingCount }, { count: orderCount }] = await Promise.all([
        supabase.rpc("batch_summary", { p_batch_id: batch.id, p_delivery: r.type }),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).eq("delivery_type", r.type).eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).eq("delivery_type", r.type).neq("status", "cancelled"),
      ]);
      return { items: ((rows ?? []) as Row[]).map((x) => ({ ...x, qty: Number(x.qty) })), pendingCount: pendingCount ?? 0, orderCount: orderCount ?? 0 };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[34px] leading-tight">Batch summary</h1>
        <BatchPicker batches={batches} value={batch.id} currentId={current?.id ?? null} />
      </div>
      <p className="-mt-3 text-[15px] text-muted">
        One supplier order per delivery day. {isOpen ? "Orders are still open for this batch." : "This batch is closed."}
      </p>

      {runs.map((r, i) => {
        const { items, pendingCount, orderCount } = data[i];
        const pieces = items.reduce((n, x) => n + x.qty, 0);
        const knownCost = items.reduce((n, x) => n + Number(x.supplier_cost ?? 0), 0);
        const missing = items.filter((x) => x.supplier_price === null).length;
        const closed = hasPassed(r.closesAt);
        const supplierText = [
          `Hi! Order for ${formatDay(r.date)}:`,
          "",
          ...items.map((x) => `${x.product_name} x ${x.qty}`),
          "",
          `Total: ${pieces} pcs`,
          "Thank you!",
        ].join("\n");
        return (
          <section key={r.type} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-[24px] leading-tight">
                  {r.title} · {formatDay(r.date)}
                </h2>
                <p className="text-[14px] text-muted">
                  {closed ? "Closed" : "Orders close"} {formatCutoff(r.closesAt)}
                  {!closed ? " · more orders can still come in" : ""}
                </p>
              </div>
              <a href={`/admin/batch/export?batch=${batch.id}&type=${r.type}`} className={buttonClass("secondary", "md")}>
                <Download size={18} aria-hidden /> Download Excel
              </a>
            </div>

            {r.orderedAt ? <Notice tone="success">Ordered from the supplier.</Notice> : null}

            {items.length === 0 ? (
              <EmptyState title={`No ${r.title} orders yet`} />
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
                      {items.map((x) => (
                        <tr key={x.product_name}>
                          <td className="px-4 py-2.5">{x.product_name}</td>
                          <td className="num px-4 py-2.5 text-right font-semibold">{x.qty}</td>
                          <td className="num px-4 py-2.5 text-right text-muted">
                            {x.supplier_cost === null ? <span className="text-warning">—</span> : formatPeso(x.supplier_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-black/[0.08] font-semibold">
                        <td className="px-4 py-3">{orderCount} order(s)</td>
                        <td className="num px-4 py-3 text-right">{pieces}</td>
                        <td className="num px-4 py-3 text-right">{formatPeso(knownCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </Card>
                {missing > 0 ? (
                  <p className="-mt-1 text-[13px] text-warning">
                    {missing} product(s) have no supplier price, so the supplier cost is incomplete.
                  </p>
                ) : null}
                <SupplierTools text={supplierText} batchId={batch.id} delivery={r.type} pendingCount={pendingCount} stillOpen={!closed} />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
