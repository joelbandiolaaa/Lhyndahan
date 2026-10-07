export type Batch = {
  id: string;
  code: string;
  starts_at: string;
  cutoff_at: string;
  office_date: string;
  outside_date: string;
  supplier_ordered_at: string | null;
};

export type Dashboard = {
  batch: Batch | null;
  orders: number;
  sales: number;
  unpaid: number;
  unpaid_orders: number;
  profit_known: number;
  items_no_supplier: number;
  delivery_fund: number;
  supplier_cost: number;
  pieces: number;
  by_status: Partial<Record<OrderStatus, number>>;
  by_delivery: Partial<Record<"office" | "outside", number>>;
  by_payment: Partial<Record<"cod" | "qr" | "gcash", number>>;
  top_products: { name: string; qty: number; sales: number }[];
  new_orders: number;
  repeat_customers: number;
  traffic: {
    days: number;
    visitors_today: number;
    visitors: number;
    views: number;
    orders: number;
    sources: { source: string; visitors: number }[];
    top_viewed: { slug: string; name: string; views: number }[];
    daily: { day: string; visitors: number }[];
  };
};

export type OrderStatus = "pending" | "ordered" | "delivered" | "cancelled";

export type AdminOrder = {
  id: string;
  code: string;
  name: string;
  phone: string;
  delivery_type: "office" | "outside";
  address: string;
  landmark: string;
  map_url: string | null;
  notes: string | null;
  delivery_date: string;
  payment_method: "cod" | "qr" | "gcash";
  qr_provider: string | null;
  status: OrderStatus;
  paid: boolean;
  seen_by_admin: boolean;
  total: number;
  created_at: string;
  batch_id: string;
  order_items: { id: string; product_name: string; qty: number; selling_price: number }[];
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  messenger: "Messenger",
  instagram: "Instagram",
  google: "Google",
  direct: "Direct / link",
  other: "Other",
};

/** "LH-12 / juan / 0917" → safe text for a PostgREST ilike filter (no commas or parentheses). */
export function cleanSearch(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Which batch is taking orders now, and which one closed most recently. */
export function batchContext(batches: Batch[], at: number = Date.now()) {
  const current = batches.find((b) => new Date(b.starts_at).getTime() <= at && at < new Date(b.cutoff_at).getTime()) ?? null;
  const lastClosed = batches.find((b) => new Date(b.cutoff_at).getTime() <= at) ?? null;
  // Thu–Sat after a cutoff the batch that matters (supplier order, deliveries) is the one that just closed.
  const recentlyClosed = lastClosed && at - new Date(lastClosed.cutoff_at).getTime() < 3 * 86_400_000 ? lastClosed : null;
  return { current, lastClosed, recentlyClosed, isOpen: (b: Batch) => new Date(b.cutoff_at).getTime() > at };
}
