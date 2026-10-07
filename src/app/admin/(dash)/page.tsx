import {
  AlertTriangle, ArrowRight, Banknote, CircleCheck, Eye, HandCoins, Heart, MousePointerClick, Package, PiggyBank,
  ReceiptText, ShoppingBag, TrendingUp, Users, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Notice } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { batchContext, SOURCE_LABELS, type Batch, type Dashboard } from "@/lib/admin";
import { formatCutoff, formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { getBatchPreview } from "@/lib/shop";
import { BatchPicker } from "./batch-picker";
import { Countdown } from "./countdown";
import { VisitorsChart } from "./visitors-chart";

function Stat({ label, value, sub, href, tone, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; tone?: "warning"; icon?: LucideIcon }) {
  const body = (
    <Card className={`flex h-full flex-col gap-1 p-4 ${href ? "transition-colors hover:bg-white/70" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted">{label}</p>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-link">
            <Icon size={17} strokeWidth={1.9} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className={`num text-[26px] leading-tight font-semibold ${tone === "warning" ? "text-warning" : "text-ink"}`}>{value}</p>
      {sub ? <p className="text-[13px] text-muted">{sub}</p> : null}
    </Card>
  );
  return href ? (
    <Link href={href} className="tap block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex justify-between text-[15px]">
        <span>{label}</span>
        <span className="num text-muted">
          {value} · {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export default async function AdminHome(props: PageProps<"/admin">) {
  const sp = await props.searchParams;
  const { supabase } = await requireAdmin();
  const batchId = typeof sp.batch === "string" && /^[0-9a-f-]{36}$/i.test(sp.batch) ? sp.batch : null;

  const [{ data, error }, { data: batchRows }, preview] = await Promise.all([
    supabase.rpc("admin_dashboard", { p_batch_id: batchId, p_days: 7 }),
    supabase.from("batches").select("*").order("cutoff_at", { ascending: false }).limit(26),
    getBatchPreview(),
  ]);
  const d = data as Dashboard | null;
  const batches = (batchRows ?? []) as Batch[];
  const { current } = batchContext(batches);
  const cutoffAt = d?.batch?.cutoff_at ?? preview?.cutoff_at ?? null;
  const isCurrent = !batchId || batchId === current?.id;

  if (error || !d) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-[34px] leading-tight">Overview</h1>
        <Notice tone="error">Could not load the dashboard. Please refresh the page.</Notice>
      </div>
    );
  }

  const t = d.traffic;
  const conversion = t.visitors > 0 ? Math.round((t.orders / t.visitors) * 1000) / 10 : 0;
  const deliveryTotal = (d.by_delivery.office ?? 0) + (d.by_delivery.outside ?? 0);
  const qrCount = (d.by_payment.qr ?? 0) + (d.by_payment.gcash ?? 0);
  const paymentTotal = (d.by_payment.cod ?? 0) + qrCount;
  const sourceTotal = t.sources.reduce((n, s) => n + s.visitors, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[34px] leading-tight">Overview</h1>
        <BatchPicker batches={batches} value={d.batch?.id ?? current?.id ?? null} currentId={current?.id ?? null} />
      </div>

      {d.new_orders > 0 ? (
        <Link href="/admin/orders" className="tap flex items-center justify-between rounded-[var(--radius-card)] bg-accent px-4 py-3 text-accent-ink">
          <span className="text-[17px] font-medium">
            <span className="num">{d.new_orders}</span> new order(s)
          </span>
          <ArrowRight size={20} aria-hidden />
        </Link>
      ) : null}

      {/* Batch header */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="text-[13px] text-muted">{isCurrent ? "This week's batch" : "Batch"}</p>
          <p className="text-[17px]">
            Delivery {formatDay(d.batch?.office_date ?? preview?.office_date ?? "")} and{" "}
            {formatDay(d.batch?.outside_date ?? preview?.outside_date ?? "", { weekday: false })}
          </p>
          {cutoffAt ? <p className="text-[13px] text-muted">Cutoff: {formatCutoff(cutoffAt)}</p> : null}
        </div>
        {isCurrent && cutoffAt ? (
          <div className="sm:text-right">
            <p className="text-[13px] text-muted">Time left</p>
            <p className="text-[26px] leading-tight font-semibold">
              <Countdown cutoffAt={cutoffAt} />
            </p>
          </div>
        ) : null}
      </Card>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={ShoppingBag} label="Orders" value={d.orders} sub={`${d.pieces} pcs`} href="/admin/orders" />
        <Stat icon={Banknote} label="Sales" value={formatPeso(d.sales)} sub={d.orders ? `avg ${formatPeso(d.sales / d.orders)}/order` : undefined} />
        <Stat icon={TrendingUp}
          label="Profit (known)"
          value={formatPeso(d.profit_known)}
          sub={d.items_no_supplier > 0 ? <span className="text-warning">incomplete: {d.items_no_supplier} item(s) missing a supplier price</span> : "complete"}
          href={d.items_no_supplier > 0 ? "/admin/products" : undefined}
        />
        <Stat icon={HandCoins} label="Unpaid" value={formatPeso(d.unpaid)} sub={`${d.unpaid_orders} order(s)`} tone={d.unpaid > 0 ? "warning" : undefined}
          href={d.unpaid_orders > 0 ? "/admin/orders?paid=unpaid" : undefined} />
        <Stat icon={PiggyBank} label="Delivery fund" value={formatPeso(d.delivery_fund)} sub="saved from markup" />
        <Stat icon={ReceiptText} label="Owed to supplier" value={formatPeso(d.supplier_cost)} sub={d.items_no_supplier > 0 ? "incomplete" : undefined} href="/admin/batch" />
        <Stat icon={CircleCheck} label="Status" value={`${d.by_status.delivered ?? 0}/${d.orders}`} sub={`delivered · ${d.by_status.pending ?? 0} pending`} />
        <Stat icon={Heart} label="Repeat customers" value={d.repeat_customers} sub="customers who ordered again" />
      </section>

      {d.orders > 0 ? (
        <section className="grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Top products this batch</h2>
            <ol className="mt-3 flex flex-col gap-2 text-[15px]">
              {d.top_products.map((p, i) => (
                <li key={p.name} className="flex justify-between gap-3">
                  <span>
                    <span className="num text-muted">{i + 1}.</span> {p.name}
                  </span>
                  <span className="num shrink-0 text-muted">× {p.qty}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Delivery</h2>
            <ul className="mt-3 flex flex-col gap-3">
              <Bar label="KUS (Friday)" value={d.by_delivery.office ?? 0} total={deliveryTotal} />
              <Bar label="Outside (Saturday)" value={d.by_delivery.outside ?? 0} total={deliveryTotal} />
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Payment method</h2>
            <ul className="mt-3 flex flex-col gap-3">
              <Bar label="COD" value={d.by_payment.cod ?? 0} total={paymentTotal} />
              <Bar label="QR Code" value={qrCount} total={paymentTotal} />
            </ul>
          </Card>
        </section>
      ) : null}

      {/* Traffic */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[22px]">Traffic · last {t.days} days</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={Users} label="Visitors today" value={t.visitors_today} />
          <Stat icon={Eye} label={`Visitors (${t.days} days)`} value={t.visitors} sub={`${t.views} page views`} />
          <Stat icon={Package} label="Orders" value={t.orders} sub={`${t.days} days`} />
          <Stat icon={MousePointerClick} label="Conversion" value={`${conversion}%`} sub="of visitors placed an order" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4 md:col-span-1">
            <h3 className="text-[15px] font-semibold">Visitors per day</h3>
            <div className="mt-4">
              <VisitorsChart daily={t.daily} />
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-[15px] font-semibold">Traffic sources</h3>
            {t.sources.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">No data yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {t.sources.map((s) => (
                  <Bar key={s.source} label={SOURCE_LABELS[s.source] ?? s.source} value={s.visitors} total={sourceTotal} />
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="text-[15px] font-semibold">Most viewed</h3>
            {t.top_viewed.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">No data yet.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2 text-[15px]">
                {t.top_viewed.map((p, i) => (
                  <li key={p.slug} className="flex justify-between gap-3">
                    <span>
                      <span className="num text-muted">{i + 1}.</span> {p.name}
                    </span>
                    <span className="num shrink-0 text-muted">{p.views} views</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        {t.visitors >= 20 && conversion < 2 ? (
          <p className="flex items-start gap-2 text-[13px] text-muted">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            Lots of people are looking but few are ordering. Try adding real photos and check that prices are clear.
          </p>
        ) : null}
      </section>
    </div>
  );
}
