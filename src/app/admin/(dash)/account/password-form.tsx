"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});

  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-5">
        <h2 className="font-display text-xl">Change password</h2>
        <Field label="New password" name="password" required hint="At least 10 characters. Try 3–4 words, e.g. hopia-ube-tipas-2026.">
          {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={10} required />}
        </Field>
        <Field label="Repeat new password" name="confirm" required>
          {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}
        </Field>
        {state.message ? <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice> : null}
        <Button type="submit" size="lg" loading={pending}>
          {pending ? "Changing…" : "Save new password"}
        </Button>
      </form>
    </Card>
  );
}
