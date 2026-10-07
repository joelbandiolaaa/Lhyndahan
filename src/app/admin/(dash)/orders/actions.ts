"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
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
