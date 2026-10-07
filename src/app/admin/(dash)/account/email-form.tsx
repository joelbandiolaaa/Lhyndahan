"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { changeEmail, type AccountState } from "./actions";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changeEmail, {});

  return (
    <Card className="p-5">
      <form
        action={action}
        onSubmit={(e) => {
          const next = String(new FormData(e.currentTarget).get("email") ?? "").trim();
          if (!confirm(`From now on you will log in with ${next}. Make sure it's spelled correctly. Continue?`)) e.preventDefault();
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <h2 className="font-display text-xl">Change login email</h2>
          <p className="text-[15px] text-muted">Now: {currentEmail}. You&apos;ll be logged out and log in again with the new one.</p>
        </div>
        <Field label="New email" name="email" required>
          {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="off" required />}
        </Field>
        <Field label="Repeat new email" name="email-confirm" required hint="Typed twice because a typo here would lock you out.">
          {(p) => <Input {...p} name="confirm" type="email" inputMode="email" autoComplete="off" required />}
        </Field>
        <Field label="Current password" name="email-current" required>
          {(p) => <Input {...p} name="current" type="password" autoComplete="current-password" required />}
        </Field>
        {state.message ? <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice> : null}
        <Button type="submit" size="lg" loading={pending}>
          {pending ? "Changing…" : "Change email"}
        </Button>
      </form>
    </Card>
  );
}
