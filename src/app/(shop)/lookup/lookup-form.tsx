"use client";

import { useActionState } from "react";
import { OrderSummary } from "@/components/shop/order-summary";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { lookupAction, type LookupState } from "../order/actions";

export function LookupForm({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, {});

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <Field label="Order number" name="code" required>
          {(p) => (
            <Input {...p} name="code" defaultValue={state.values?.code ?? defaultCode} placeholder="LH-0012" autoCapitalize="characters"
              autoComplete="off" required />
          )}
        </Field>
        <Field label="Mobile number" name="phone" required>
          {(p) => (
            <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" defaultValue={state.values?.phone ?? ""} required />
          )}
        </Field>
        {state.message ? <Notice tone="error">{state.message}</Notice> : null}
        <Button type="submit" size="lg" loading={pending}>
          {pending ? "Looking…" : "Find order"}
        </Button>
      </form>
      {state.order ? <OrderSummary order={state.order} /> : null}
    </div>
  );
}
