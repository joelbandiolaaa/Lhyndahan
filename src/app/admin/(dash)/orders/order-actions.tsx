"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/lib/admin";
import { setOrderPaid, setOrderStatus } from "./actions";

/** One-tap buttons: the next step in Pending → Ordered → Delivered, plus payment. */
export function OrderActions({
  id,
  code,
  status,
  paid,
}: {
  id: string;
  code: string;
  status: OrderStatus;
  paid: boolean;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key);
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      setBusy(null);
    });
  }

  if (status === "cancelled") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="md" variant="secondary" loading={busy === "restore"} disabled={pending}
          onClick={() => run("restore", () => setOrderStatus(id, "pending"))}>
          Move back to Pending
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "pending" ? (
          <Button loading={busy === "ordered"} disabled={pending} onClick={() => run("ordered", () => setOrderStatus(id, "ordered"))}>
            Mark Ordered
          </Button>
        ) : null}
        {status === "ordered" ? (
          <Button loading={busy === "delivered"} disabled={pending} onClick={() => run("delivered", () => setOrderStatus(id, "delivered"))}>
            Mark Delivered
          </Button>
        ) : null}
        {!paid ? (
          <Button variant="secondary" loading={busy === "paid"} disabled={pending} onClick={() => run("paid", () => setOrderPaid(id, true))}>
            Mark as Paid
          </Button>
        ) : (
          <Button variant="ghost" loading={busy === "unpaid"} disabled={pending} onClick={() => run("unpaid", () => setOrderPaid(id, false))}>
            Mark as Unpaid
          </Button>
        )}
        {status !== "pending" ? (
          <Button variant="ghost" loading={busy === "back"} disabled={pending}
            onClick={() => run("back", () => setOrderStatus(id, status === "delivered" ? "ordered" : "pending"))}>
            Undo status
          </Button>
        ) : null}
        <Button variant="danger" loading={busy === "cancel"} disabled={pending}
          onClick={() => {
            if (confirm(`Cancel order ${code}?\n\nIt won't count toward the supplier order, deliveries or sales anymore. You can move it back to Pending later if you change your mind.`)) {
              run("cancel", () => setOrderStatus(id, "cancelled"));
            }
          }}>
          Cancel order
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
