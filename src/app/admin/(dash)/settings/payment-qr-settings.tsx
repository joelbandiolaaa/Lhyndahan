"use client";

/* eslint-disable @next/next/no-img-element -- small uploaded QR images */
import { Eye, EyeOff, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SITE_BUCKET } from "@/lib/env";
import { compressImage } from "@/lib/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { ActionResult } from "@/lib/types";
import { addPaymentQr, deletePaymentQr, setPaymentQrActive, updatePaymentQr } from "./actions";

export type QrRow = { id: string; label: string; accountName: string; accountNumber: string; imageUrl: string; active: boolean };

function ResultNotice({ result }: { result: ActionResult | null }) {
  return result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null;
}

function QrCard({ qr }: { qr: QrRow }) {
  const router = useRouter();
  const [form, setForm] = useState({ label: qr.label, account_name: qr.accountName, account_number: qr.accountNumber });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const dirty = form.label !== qr.label || form.account_name !== qr.accountName || form.account_number !== qr.accountNumber;

  return (
    <div className={`flex flex-col gap-4 rounded-xl border border-line p-4 ${qr.active ? "" : "bg-sunken"}`}>
      <div className="flex gap-4">
        <img src={qr.imageUrl} alt={`${qr.label} QR code`} className="size-28 shrink-0 rounded-lg bg-white object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Field label="Name shown at checkout" name={`label-${qr.id}`} error={errors.label}>
            {(p) => <Input {...p} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />}
          </Field>
        </div>
      </div>
      <Field label="Account name" name={`name-${qr.id}`} error={errors.account_name} hint="So customers can check they're paying the right person.">
        {(p) => <Input {...p} value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />}
      </Field>
      <Field label="Account number" name={`num-${qr.id}`} error={errors.account_number}>
        {(p) => <Input {...p} inputMode="tel" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" loading={pending} disabled={!dirty} onClick={() => start(async () => { setResult(await updatePaymentQr(qr.id, form)); router.refresh(); })}>
          Save
        </Button>
        <Button
          type="button" variant="secondary" loading={pending}
          onClick={() => start(async () => { setResult(await setPaymentQrActive(qr.id, !qr.active)); router.refresh(); })}
        >
          {qr.active ? <><EyeOff size={18} aria-hidden /> Hide</> : <><Eye size={18} aria-hidden /> Show</>}
        </Button>
        <Button
          type="button" variant="danger"
          onClick={() => {
            if (!confirm(`Remove the ${qr.label} QR? Customers who already ordered with it won't see the QR on their order page anymore. Use Hide instead to keep it.`)) return;
            start(async () => { setResult(await deletePaymentQr(qr.id)); router.refresh(); });
          }}
        >
          <Trash2 size={18} aria-hidden /> Remove
        </Button>
        {!qr.active ? <span className="text-[13px] text-muted">Hidden from checkout</span> : null}
      </div>
      <ResultNotice result={result} />
    </div>
  );
}

function AddQr() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ label: "", account_name: "", account_number: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function choose(f: File | undefined) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f ?? null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setResult({ ok: false, message: "Choose the QR image first." });
    setBusy(true);
    setResult(null);
    try {
      // Keep QR codes sharp: PNG stays PNG unless it's huge.
      const blob = file.type === "image/png" && file.size < 2_000_000 ? file : await compressImage(file);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const path = `qr/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabaseBrowser().storage.from(SITE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      const res = await addPaymentQr({ ...form, path });
      setResult(res);
      if (res.ok) {
        setForm({ label: "", account_name: "", account_number: "" });
        choose(undefined);
        if (fileInput.current) fileInput.current.value = "";
        router.refresh();
      }
    } catch {
      setResult({ ok: false, message: "Couldn't upload the QR. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-dashed border-line p-4">
      <h3 className="text-[17px] font-semibold">Add a QR code</h3>
      <div className="flex flex-col items-start gap-3">
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        {preview ? <img src={preview} alt="QR preview" className="size-40 rounded-lg bg-white object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" /> : null}
        <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
          <ImagePlus size={18} aria-hidden /> {file ? "Choose a different image" : "Choose QR image"}
        </Button>
        <p className="text-[13px] text-muted">In the app: Receive / My QR → Save or Download, then pick the saved image here.</p>
      </div>
      <Field label="Name shown at checkout" name="new-label" required error={errors.label} hint="E.g. GCash, Maya, BPI.">
        {(p) => <Input {...p} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />}
      </Field>
      <Field label="Account name" name="new-name" error={errors.account_name} hint="Optional. So customers can check they're paying the right person.">
        {(p) => <Input {...p} value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />}
      </Field>
      <Field label="Account number" name="new-num" error={errors.account_number} hint="Optional.">
        {(p) => <Input {...p} inputMode="tel" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />}
      </Field>
      <Button type="submit" loading={busy} className="self-start">
        Add QR
      </Button>
      <ResultNotice result={result} />
    </form>
  );
}

export function PaymentQrSettings({ qrs }: { qrs: QrRow[] }) {
  return (
    <Card className="flex flex-col gap-5 p-5">
      <div>
        <h2 className="font-display text-[22px]">QR Code payment</h2>
        <p className="text-[15px] text-muted">
          Customers pick one of these at checkout and see its QR right after they order. With none added, the QR option is hidden and only Cash on Delivery shows.
        </p>
      </div>
      {qrs.map((q) => (
        <QrCard key={q.id} qr={q} />
      ))}
      <AddQr />
    </Card>
  );
}
