"use client";

import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { addAdminUser, removeAdminUser, resetAdminPassword, type AdminUserResult } from "./admin-actions";

// No look-alike characters (0/o, 1/l/i), so it can be read out or typed from a message.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  const out: string[] = [];
  while (out.length < 12) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    for (const b of bytes) if (b < 248 && out.length < 12) out.push(ALPHABET[b % ALPHABET.length]);
  }
  const s = out.join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function Credentials({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Lhyndahan admin login\nWebsite: ${window.location.origin}/admin/login\nEmail: ${email}\nTemporary password: ${password}\n\nPlease change your password after you log in: Settings → Change password.`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-sunken p-4">
      <p className="text-[13px] font-medium text-muted">Send this to them privately. The password is shown only once.</p>
      <pre className="font-sans text-[15px] whitespace-pre-wrap text-ink">{text}</pre>
      <Button type="button" variant="secondary" className="self-start" onClick={async () => { await copyText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied ? "Copied!" : "Copy login details"}
      </Button>
    </div>
  );
}

export function AdminUsers({ owner, me, admins }: { owner: string; me: string; admins: string[] }) {
  const router = useRouter();
  const isOwner = owner.toLowerCase() === me.toLowerCase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<AdminUserResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<AdminUserResult>, after?: (r: AdminUserResult) => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.(r);
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-[22px]">Admin logins</h2>
        <p className="text-[15px] text-muted">
          Everyone who runs the shop gets their <strong>own</strong> login, so you can add or remove a person without changing anyone else&apos;s password. All admins can do everything except add or remove people.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        <li className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="min-w-0 flex-1 text-[15px] break-all">{owner}</span>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold text-link">Owner</span>
        </li>
        {admins.map((a) => (
          <li key={a} className="flex flex-col gap-2 px-4 py-3">
            <span className="text-[15px] break-all">{a}</span>
            {isOwner ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" loading={pending} onClick={() => { const pw = generatePassword(); run(() => resetAdminPassword({ email: a, password: pw })); }}>
                  <KeyRound size={16} aria-hidden /> Reset password
                </Button>
                <Button type="button" variant="danger" disabled={pending} onClick={() => { if (confirm(`Remove ${a}? They can't log in anymore.`)) run(() => removeAdminUser(a)); }}>
                  <Trash2 size={16} aria-hidden /> Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form
          className="flex flex-col gap-4 rounded-xl border border-dashed border-line p-4"
          onSubmit={(e) => { e.preventDefault(); run(() => addAdminUser({ email, password }), () => { setEmail(""); setPassword(""); }); }}
        >
          <h3 className="text-[17px] font-semibold">Add someone</h3>
          <Field label="Their email" name="admin-new-email" hint="Use their own real email that only they can open.">
            {(p) => <Input {...p} type="email" autoComplete="off" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Temporary password" name="admin-new-password" hint="At least 10 characters. Tap Generate for a strong one. They change it after their first login.">
            {(p) => (
              <div className="flex gap-2">
                <Input {...p} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
                <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>Generate</Button>
              </div>
            )}
          </Field>
          <Button type="submit" loading={pending} disabled={!email || password.length < 10} className="self-start">Add admin</Button>
        </form>
      ) : (
        <p className="text-[14px] text-muted">Only the owner ({owner}) can add or remove admins.</p>
      )}

      {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
      {result?.ok && result.credentials ? <Credentials email={result.credentials.email} password={result.credentials.password} /> : null}
    </Card>
  );
}
