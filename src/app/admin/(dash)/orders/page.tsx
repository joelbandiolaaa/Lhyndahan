import { Download, MapPin, MessageSquareText, Phone } from "lucide-react";
import Link from "next/link";
import { Card, EmptyState, Notice } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { batchContext, cleanSearch, STATUS_LABELS, type AdminOrder, type Batch } from "@/lib/admin";
import { formatDateTime, formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { paymentShortLabel } from "@/lib/payment";
import { formatPhone } from "@/lib/phone";
import { OrderFilters } from "./filters";
import { MarkSeen } from "./mark-seen";
import { OrderActions } from "./order-actions";

export const metadata = { title: "Orders" };

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  ordered: "bg-accent-soft text-link",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-black/[0.06] text-muted",
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function OrdersPage(props: PageProps<"/admin/orders">) {
  const sp = await props.searchParams;
  const { supabase } = await requireAdmin();

  const { data: batchRows } = await supabase.from("batches").select("*").order("cutoff_at", { ascending: false }).limit(26);
  const batches = (batchRows ?? []) as Batch[];
  const { current } = batchContext(batches);

  const batchParam = one(sp.batch) ?? current?.id ?? "all";
  const status = one(sp.status);
  const paid = one(sp.paid);
  const delivery = one(sp.delivery);
  const pay = one(sp.pay);
  const q = cleanSearch(one(sp.q) ?? "");

  // Every filter except status; status becomes the tabs (with counts) below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters<T extends { eq: any; or: any; in: any }>(qb: T): T {
    let r = qb;
    if (batchParam !== "all" && /^[0-9a-f-]{36}$/i.test(batchParam)) r = r.eq("batch_id", batchParam);
    if (paid === "paid") r = r.eq("paid", true);
    if (paid === "unpaid") r = r.eq("paid", false);
    if (delivery === "office" || delivery === "outside") r = r.eq("delivery_type", delivery);
    if (pay === "cod") r = r.eq("payment_method", "cod");
    if (pay === "qr") r = r.in("payment_method", ["qr", "gcash"]);
    if (q) {
      const digits = q.replace(/\D/g, "");
      const parts = [`name.ilike.%${q}%`, `code.ilike.%${q}%`];
      if (digits.length >= 4) parts.push(`phone.ilike.%${digits.replace(/^0/, "")}%`);
      r = r.or(parts.join(","));
    }
    return r;
  }

  let query = applyFilters(
    supabase
      .from("orders")
      .select("id, code, name, phone, delivery_type, address, landmark, map_url, notes, delivery_date, payment_method, qr_provider, status, paid, seen_by_admin, total, created_at, batch_id, order_items(id, product_name, qty, selling_price)")
      .order("created_at", { ascending: false })
      .limit(300),
  );
  if (status && status in STATUS_LABELS) query = query.eq("status", status);
  const { data: statusRows } = await applyFilters(supabase.from("orders").select("status").limit(5000));
  const counts: Record<string, number> = { all: 0 };
  for (const r of (statusRows ?? []) as { status: string }[]) {
    counts.all++;
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  const tabHref = (s: string | null) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "status" && typeof v === "string" && v) p.set(k, v);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  const exportParams = new URLSearchParams();
  if (batchParam !== "all") exportParams.set("batch", batchParam);
  for (const [k, v] of Object.entries({ status, paid, delivery, pay, q })) if (v) exportParams.set(k, v);

  const { data, error } = await query;
  const orders = (data ?? []) as AdminOrder[];
  const live = orders.filter((o) => o.status !== "cancelled");
  const sum = live.reduce((n, o) => n + Number(o.total), 0);
  const unpaid = live.filter((o) => !o.paid).reduce((n, o) => n + Number(o.total), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[34px] leading-tight">Orders</h1>
        <a
          href={`/admin/orders/export?${exportParams.toString()}`}
          className="tap flex min-h-11 items-center gap-2 rounded-full bg-accent-soft px-4 text-[15px] font-medium text-link"
        >
          <Download size={18} aria-hidden /> Export to Excel
        </a>
      </div>
      <OrderFilters batches={batches} currentBatchId={current?.id ?? null} />

      {/* Order board tabs, food-delivery partner style */}
      <nav aria-label="Status" className="-mx-4 flex overflow-x-auto border-b border-line bg-surface px-2 [scrollbar-width:none] md:mx-0 md:rounded-t-xl">
        {([null, "pending", "ordered", "delivered", "cancelled"] as const).map((s) => {
          const on = (status ?? null) === s;
          const n = counts[s ?? "all"] ?? 0;
          return (
            <Link
              key={s ?? "all"}
              href={tabHref(s)}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-12 shrink-0 items-center gap-1.5 px-3.5 text-[15px] whitespace-nowrap ${on ? "font-semibold text-link" : "text-muted"}`}
            >
              {s ? STATUS_LABELS[s] : "All"}
              <span className={`num rounded-full px-1.5 text-[12px] font-semibold ${on ? "bg-accent text-accent-ink" : "bg-black/[0.06] text-muted"}`}>{n}</span>
              <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-accent ${on ? "" : "opacity-0"}`} />
            </Link>
          );
        })}
      </nav>

      {error ? <Notice tone="error">Could not load orders. Please refresh the page.</Notice> : null}

      {orders.length > 0 ? (
        <p className="num text-[15px] text-muted">
          {orders.length} order(s) · {formatPeso(sum)} sales · <span className="text-warning">{formatPeso(unpaid)} unpaid</span>
          {orders.length === 300 ? " · showing the latest 300" : ""}
        </p>
      ) : null}

      {!error && orders.length === 0 ? (
        <EmptyState
          title="No orders here"
          body={q || status || paid || delivery || pay ? "Nothing matches your filters. Try clearing them." : "Share your shop link on Facebook to get your first order."}
        />
      ) : null}

      <MarkSeen ids={orders.filter((o) => !o.seen_by_admin).map((o) => o.id)} />

      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Card className={`flex flex-col gap-4 p-4 ${o.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-[17px] font-semibold">
                    {o.code}
                    {!o.seen_by_admin ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">NEW</span> : null}
                  </p>
                  <p className="text-[13px] text-muted">{formatDateTime(o.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_TONE[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${o.paid ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                    {o.paid ? "Paid" : "Unpaid"} · {paymentShortLabel(o.payment_method, o.qr_provider)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-[15px]">
                <p className="text-[17px]">{o.name}</p>
                <a href={`tel:${o.phone}`} className="flex w-fit items-center gap-1.5 text-link">
                  <Phone size={15} aria-hidden /> {formatPhone(o.phone)}
                </a>
                <p className="mt-1">
                  <span className="font-medium">{o.delivery_type === "office" ? "KUS" : "Outside"}</span> ·{" "}
                  {formatDay(o.delivery_date)}
                </p>
                <p className="text-muted">{o.address}</p>
                {o.landmark ? <p className="text-muted">Landmark: {o.landmark}</p> : null}
                {o.map_url ? (
                  <a href={o.map_url} target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-1.5 text-link">
                    <MapPin size={15} aria-hidden /> Open in Google Maps
                  </a>
                ) : null}
                {o.notes ? (
                  <p className="mt-1 flex gap-1.5 rounded-xl bg-sunken px-3 py-2 text-ink">
                    <MessageSquareText size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /> {o.notes}
                  </p>
                ) : null}
              </div>

              <ul className="flex flex-col gap-0.5 border-t border-black/[0.08] pt-3 text-[15px]">
                {o.order_items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>
                      <span className="num text-muted">{i.qty}×</span> {i.product_name}
                    </span>
                    <span className="num text-muted">{formatPeso(i.selling_price * i.qty)}</span>
                  </li>
                ))}
                <li className="mt-1 flex justify-between gap-3 font-semibold">
                  <span>Total</span>
                  <span className="num">{formatPeso(o.total)}</span>
                </li>
              </ul>

              <OrderActions id={o.id} code={o.code} status={o.status} paid={o.paid} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
