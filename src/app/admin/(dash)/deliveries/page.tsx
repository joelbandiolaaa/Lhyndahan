import { Building2, ExternalLink, MapPin, Phone, StickyNote } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { batchContext, type AdminOrder, type Batch } from "@/lib/admin";
import { formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { paymentShortLabel } from "@/lib/payment";
import { formatPhone } from "@/lib/phone";
import { BatchPicker } from "../batch-picker";
import { riderRunText, riderText } from "@/lib/rider";
import { CopyButton } from "./copy-button";
import { PrintButton } from "./print-button";

export const metadata = { title: "Deliveries" };

type Row = Pick<
  AdminOrder,
  "id" | "code" | "name" | "phone" | "delivery_type" | "address" | "landmark" | "map_url" | "notes" | "payment_method" | "qr_provider" | "status" | "paid" | "total" | "created_at" | "order_items"
>;

/** What the rider/you must collect at the door. QR-paid and already-paid orders collect nothing. */
function amountDue(o: Row) {
  return o.payment_method === "cod" && !o.paid ? o.total : 0;
}

function DeliveryCard({ o, n }: { o: Row; n: number }) {
  const due = amountDue(o);
  return (
    <Card className="break-inside-avoid p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            <span className="num">#{n}</span> · <span className="num">{o.code}</span>
          </p>
          <p className="text-[17px] font-semibold">{o.name}</p>
          <a href={`tel:${o.phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] whitespace-nowrap text-link">
            <Phone size={15} aria-hidden /> {formatPhone(o.phone)}
          </a>
        </div>
        <div className="shrink-0 sm:text-right">
          {due > 0 ? (
            <>
              <p className="text-[13px] text-muted">Collect (COD)</p>
              <p className="num text-[20px] font-semibold text-ink">{formatPeso(due)}</p>
            </>
          ) : (
            <p className={`w-fit rounded-full px-3 py-1 text-[13px] font-semibold ${o.paid ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
              {o.paid ? "Paid" : `${paymentShortLabel(o.payment_method, o.qr_provider)} · not yet confirmed`}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-0.5 border-t border-line pt-3 text-[15px]">
        {o.order_items.map((i) => (
          <li key={i.id} className="flex gap-2">
            <span className="num w-8 shrink-0 font-semibold">{i.qty}×</span>
            <span>{i.product_name}</span>
          </li>
        ))}
      </ul>

      {o.delivery_type === "outside" ? (
        <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-[15px]">
          <p>{o.address}</p>
          {o.landmark ? <p className="text-muted">Landmark: {o.landmark}</p> : null}
          {o.map_url ? (
            <a href={o.map_url} target="_blank" rel="noopener noreferrer" className="no-print inline-flex min-h-11 w-fit items-center gap-1.5 text-link">
              <MapPin size={15} aria-hidden /> Open in Maps <ExternalLink size={13} aria-hidden />
            </a>
          ) : null}
          <div className="mt-2">
            <CopyButton text={riderText(o, n)} label="Copy for rider" />
          </div>
        </div>
      ) : null}

      {o.notes ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-[14px]">
          <StickyNote size={15} className="mt-0.5 shrink-0 text-link" aria-hidden /> {o.notes}
        </p>
      ) : null}
    </Card>
  );
}

function Group({
  title,
  icon,
  date,
  orders,
  forRider = false,
}: {
  title: string;
  icon: React.ReactNode;
  date: string;
  orders: Row[];
  forRider?: boolean;
}) {
  const due = orders.reduce((n, o) => n + amountDue(o), 0);
  const pieces = orders.reduce((n, o) => n + o.order_items.reduce((m, i) => m + i.qty, 0), 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[22px]">
          {icon} {title} <span className="text-[15px] font-normal text-muted">· {formatDay(date)}</span>
        </h2>
        <p className="text-[14px] text-muted">
          <span className="num">{orders.length}</span> order{orders.length === 1 ? "" : "s"} · <span className="num">{pieces}</span> pcs · collect{" "}
          <span className="num font-semibold text-ink">{formatPeso(due)}</span>
        </p>
      </div>
      {forRider && orders.length > 0 ? (
        <CopyButton variant="primary" label={`Copy all ${orders.length} for rider`} text={riderRunText(`${title} · ${formatDay(date)}`, orders)} />
      ) : null}
      {orders.length === 0 ? (
        <EmptyState title="No deliveries" body="Nothing to deliver for this day in this batch." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((o, i) => (
            <DeliveryCard key={o.id} o={o} n={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DeliveriesPage(props: PageProps<"/admin/deliveries">) {
  const sp = await props.searchParams;
  const { supabase } = await requireAdmin();

  const { data: batchRows } = await supabase.from("batches").select("*").order("cutoff_at", { ascending: false }).limit(26);
  const batches = (batchRows ?? []) as Batch[];
  const { current, lastClosed, recentlyClosed } = batchContext(batches);
  const wanted = typeof sp.batch === "string" ? sp.batch : undefined;
  const batch = batches.find((b) => b.id === wanted) ?? recentlyClosed ?? current ?? lastClosed ?? null;

  if (!batch) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-[34px] leading-tight">Deliveries</h1>
        <EmptyState title="No batches yet" body="Delivery lists will show up here once the first order comes in." />
      </div>
    );
  }

  const { data } = await supabase
    .from("orders")
    .select("id, code, name, phone, delivery_type, address, landmark, map_url, notes, payment_method, qr_provider, status, paid, total, created_at, order_items(id, product_name, qty, selling_price)")
    .eq("batch_id", batch.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });
  const orders = (data ?? []) as Row[];
  const kus = orders.filter((o) => o.delivery_type === "office");
  const outside = orders.filter((o) => o.delivery_type === "outside");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[34px] leading-tight">Deliveries</h1>
        <div className="no-print flex flex-wrap items-center gap-2">
          <BatchPicker batches={batches} value={batch.id} currentId={current?.id ?? null} />
          <PrintButton />
        </div>
      </div>
      <p className="-mt-3 text-[14px] text-muted">Cancelled orders are left out. Amounts to collect only count unpaid COD orders.</p>

      <Group title="KUS Delivery" icon={<Building2 size={20} className="text-link" aria-hidden />} date={batch.office_date} orders={kus} />
      <Group title="My address" icon={<MapPin size={20} className="text-link" aria-hidden />} date={batch.outside_date} orders={outside} forRider />
    </div>
  );
}
