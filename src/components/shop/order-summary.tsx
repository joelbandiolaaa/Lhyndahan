import { Card } from "@/components/ui/card";
import { formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { paymentLabel } from "@/lib/payment";
import type { OrderView } from "@/app/(shop)/order/actions";

const STATUS: Record<OrderView["status"], { label: string; tone: string }> = {
  pending: { label: "Received", tone: "bg-accent-soft text-link" },
  ordered: { label: "Being prepared", tone: "bg-accent-soft text-link" },
  delivered: { label: "Delivered", tone: "bg-success-soft text-success" },
  cancelled: { label: "Cancelled", tone: "bg-danger-soft text-danger" },
};

export function OrderSummary({ order }: { order: OrderView }) {
  const s = STATUS[order.status];
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[22px] tracking-normal">{order.code}</p>
        <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${s.tone}`}>{s.label}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]">
        <dt className="text-muted">Delivery</dt>
        <dd>
          {formatDay(order.delivery_date)} · {order.delivery_type === "office" ? "KUS Delivery" : "My address"}
        </dd>
        <dt className="text-muted">Payment</dt>
        <dd>
          {paymentLabel(order.payment_method, order.qr_provider)} ·{" "}
          {order.paid ? (
            <span className="text-success">Paid (confirmed)</span>
          ) : order.payment_method !== "cod" ? (
            <span className="text-warning">Waiting for payment confirmation</span>
          ) : (
            <span className="text-muted">Pay on delivery</span>
          )}
        </dd>
      </dl>
      <ul className="flex flex-col gap-1 border-t border-black/[0.08] pt-3 text-[15px]">
        {order.items.map((i) => (
          <li key={`${i.name}-${i.qty}`} className="flex justify-between gap-3">
            <span className="text-muted">
              <span className="num">{i.qty}×</span> {i.name}
            </span>
            <span className="num shrink-0">{formatPeso(i.price * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-black/[0.08] pt-3">
        <span className="text-[15px] text-muted">Total</span>
        <span className="num text-[22px] font-semibold">{formatPeso(order.total)}</span>
      </div>
    </Card>
  );
}
