"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { message: initialError });

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <Field label="Email" name="email" required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <Field label="Password" name="password" required>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
