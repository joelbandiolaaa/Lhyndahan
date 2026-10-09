import { formatPeso } from "@/lib/money";
import { paymentShortLabel, type PaymentMethod } from "@/lib/payment";
import { formatPhone } from "@/lib/phone";

export type RiderOrder = {
  code: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  map_url: string | null;
  notes: string | null;
  payment_method: PaymentMethod;
  qr_provider: string | null;
  paid: boolean;
  total: number;
  order_items: { product_name: string; qty: number }[];
};

/** The customer's own pin if they shared one; otherwise a Google Maps search for the typed address. */
export function mapLink(o: Pick<RiderOrder, "map_url" | "address" | "landmark">) {
  if (o.map_url) return { url: o.map_url, pinned: true };
  const q = [o.address, o.landmark].filter(Boolean).join(", ");
  return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, pinned: false };
}

/** Plain text for one delivery, ready to paste into a chat with the rider. */
export function riderText(o: RiderOrder, n?: number): string {
  const due = o.payment_method === "cod" && !o.paid ? o.total : 0;
  const map = mapLink(o);
  const lines = [
    `${n ? `#${n} · ` : ""}${o.code} · ${o.name}`,
    `Phone: ${formatPhone(o.phone)}`,
    `Address: ${o.address}`,
    o.landmark ? `Landmark: ${o.landmark}` : "",
    `${map.pinned ? "Map" : "Map (search, may not be exact)"}: ${map.url}`,
    "Items:",
    ...o.order_items.map((i) => `${i.qty} × ${i.product_name}`),
    due > 0
      ? `COLLECT: ${formatPeso(due)} (cash)`
      : o.paid
        ? "Payment: PAID, nothing to collect"
        : `Payment: ${paymentShortLabel(o.payment_method, o.qr_provider)}, nothing to collect`,
    o.notes ? `Notes: ${o.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** One message for the whole run: a header, then every delivery separated by a blank line. */
export function riderRunText(title: string, orders: RiderOrder[]): string {
  const totalDue = orders.reduce((n, o) => n + (o.payment_method === "cod" && !o.paid ? o.total : 0), 0);
  return [
    `${title}`,
    `${orders.length} delivery(ies) · total to collect: ${formatPeso(totalDue)}`,
    "",
    orders.map((o, i) => riderText(o, i + 1)).join("\n\n"),
  ].join("\n");
}
