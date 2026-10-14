"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

const uuid = z.uuid();
const statusSchema = z.enum(["pending", "ordered", "delivered", "cancelled"]);

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function setOrderStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const s = statusSchema.safeParse(status);
  if (!uuid.safeParse(id).success || !s.success) return { ok: false, message: "Invalid." };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: s.data, seen_by_admin: true };
  if (s.data === "ordered") patch.ordered_at = now;
  if (s.data === "delivered") patch.delivered_at = now;
  if (s.data === "cancelled") patch.cancelled_at = now;
  if (s.data === "pending") Object.assign(patch, { ordered_at: null, delivered_at: null, cancelled_at: null });

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return { ok: false, message: "Couldn't update. Please try again." };
  refresh();
  return { ok: true };
}

/** Same as setOrderStatus for many orders at once (the "custom batch" selection). Cancelling stays one-by-one on purpose. */
export async function setOrdersStatus(ids: string[], status: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const s = z.enum(["pending", "ordered", "delivered"]).safeParse(status);
  const list = z.array(uuid).min(1).max(100).safeParse(ids);
  if (!s.success || !list.success) return { ok: false, message: "Invalid selection." };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: s.data, seen_by_admin: true };
  if (s.data === "ordered") patch.ordered_at = now;
  if (s.data === "delivered") patch.delivered_at = now;
  if (s.data === "pending") Object.assign(patch, { ordered_at: null, delivered_at: null, cancelled_at: null });

  // Cancelled orders are never touched by a bulk change.
  const { data, error } = await supabase.from("orders").update(patch).in("id", list.data).neq("status", "cancelled").select("id");
  if (error) return { ok: false, message: "Couldn't update. Please try again." };
  refresh();
  return { ok: true, message: `${data?.length ?? 0} order(s) updated.` };
}

export async function setOrderPaid(id: string, paid: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid." };
  const { error } = await supabase
    .from("orders")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null, seen_by_admin: true })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't update. Please try again." };
  refresh();
  return { ok: true };
}

/**
 * Permanently removes a CANCELLED order (and its items). If it was the customer's only order,
 * the customer record goes too, so no personal details are left behind. Cannot be undone.
 */
export async function deleteCancelledOrder(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid." };

  const { data: order } = await supabase.from("orders").select("id, status, customer_id").eq("id", id).maybeSingle();
  if (!order) return { ok: false, message: "That order no longer exists." };
  if (order.status !== "cancelled") return { ok: false, message: "Only cancelled orders can be deleted. Cancel it first." };

  // The status check is repeated in the delete itself, so an order moved back to Pending in the meantime is safe.
  const { data: removed, error } = await supabase.from("orders").delete().eq("id", id).eq("status", "cancelled").select("id");
  if (error || !removed?.length) return { ok: false, message: "Couldn't delete. Please try again." };

  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", order.customer_id);
  if (count === 0) await supabase.from("customers").delete().eq("id", order.customer_id);

  refresh();
  return { ok: true, message: "Order deleted." };
}

/** Called when the orders list is opened: clears the "new order" badge for what was shown. */
export async function markSeen(ids: string[]): Promise<void> {
  const { supabase } = await requireAdmin();
  const parsed = z.array(uuid).max(500).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) return;
  await supabase.from("orders").update({ seen_by_admin: true }).in("id", parsed.data).eq("seen_by_admin", false);
  revalidatePath("/admin", "layout");
}

/** Thursday button: every Pending order in the batch becomes Ordered. */
export async function markBatchOrdered(batchId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(batchId).success) return { ok: false, message: "Invalid batch." };
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "ordered", ordered_at: now, seen_by_admin: true })
    .eq("batch_id", batchId)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, message: "Couldn't update. Please try again." };
  await supabase.from("batches").update({ supplier_ordered_at: now }).eq("id", batchId);
  refresh();
  return { ok: true, message: `${data?.length ?? 0} order(s) marked as Ordered.` };
}

/** Late order: put it into another batch (usually the one that just closed) and give it that batch's delivery date. */
export async function moveOrderToBatch(orderId: string, batchId: string): Promise<ActionResult & { deliveryDate?: string }> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(batchId).success) return { ok: false, message: "Invalid." };
  const { data, error } = await supabase.rpc("move_order_to_batch", { p_order_id: orderId, p_batch_id: batchId });
  if (error) {
    const msg = error.message.includes("not_movable")
      ? "Only Pending or Ordered orders can be moved."
      : "Couldn't move the order. Please try again.";
    return { ok: false, message: msg };
  }
  const r = data as { delivery_date: string; supplier_ordered: boolean };
  // No revalidate here on purpose: the order leaves this list once moved, and the confirmation (with the
  // customer message to copy) must stay on screen. The "Done" button refreshes the page.
  return {
    ok: true,
    deliveryDate: r.delivery_date,
    message: `Moved. Delivery is now ${formatDay(r.delivery_date)}.${r.supplier_ordered ? " That batch was already ordered from the supplier, so this is an add-on." : ""}`,
  };
}
