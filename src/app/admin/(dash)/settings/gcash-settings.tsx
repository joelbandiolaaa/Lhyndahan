"use client";

/* eslint-disable @next/next/no-img-element -- small uploaded QR image */
import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SITE_BUCKET } from "@/lib/env";
import { compressImage } from "@/lib/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { ActionResult } from "@/lib/types";
import { saveGcashDetails, setGcashQr } from "./actions";

export function GcashSettings({ qrUrl, name, number }: { qrUrl: string | null; name: string; number: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ gcash_name: name, gcash_number: number });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      // Keep QR codes sharp: larger max size, and PNG stays PNG.
      const blob = file.type === "image/png" && file.size < 2_000_000 ? file : await compressImage(file);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const path = `gcash/qr-${Date.now()}.${ext}`;
      const { error } = await supabaseBrowser().storage.from(SITE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      setResult(await setGcashQr(path));
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Couldn't upload the QR. Please try again." });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div>
        <h2 className="font-display text-[22px]">GCash</h2>
        <p className="text-[15px] text-muted">Shown at checkout when the customer picks GCash.</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {qrUrl ? (
          <img src={qrUrl} alt="GCash QR code" className="w-56 max-w-full rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
        ) : (
          <div className="flex aspect-square w-56 max-w-full items-center justify-center rounded-xl bg-sunken p-6 text-center text-[15px] text-muted">
            No GCash QR yet
          </div>
        )}
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" loading={uploading} onClick={() => fileInput.current?.click()}>
            <ImagePlus size={18} aria-hidden /> {qrUrl ? "Replace QR" : "Upload QR"}
          </Button>
          {qrUrl ? (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (!confirm("Remove the GCash QR?")) return;
                setResult(await setGcashQr(null));
                router.refresh();
              }}
            >
              <Trash2 size={18} aria-hidden /> Remove
            </Button>
          ) : null}
        </div>
        <p className="text-center text-[13px] text-muted">In the GCash app: Receive → QR → Save/Download, then upload it here.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          startSave(async () => setResult(await saveGcashDetails(form)));
        }}
        className="flex flex-col gap-4"
      >
        <Field label="GCash account name" name="gcash_name" error={errors.gcash_name} hint="So customers can check they're paying the right person, e.g. A**** L. B.">
          {(p) => <Input {...p} value={form.gcash_name} onChange={(e) => setForm((f) => ({ ...f, gcash_name: e.target.value }))} />}
        </Field>
        <Field label="GCash number" name="gcash_number" error={errors.gcash_number}>
          {(p) => (
            <Input {...p} type="tel" inputMode="tel" placeholder="0917 123 4567" value={form.gcash_number}
              onChange={(e) => setForm((f) => ({ ...f, gcash_number: e.target.value }))} />
          )}
        </Field>
        <Button type="submit" loading={saving} className="self-start">
          Save
        </Button>
      </form>

      {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
    </Card>
  );
}
