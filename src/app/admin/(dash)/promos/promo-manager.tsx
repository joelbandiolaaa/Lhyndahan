"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PromoCard } from "@/components/shop/promo-card";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import { formatDateTime, toManilaInput } from "@/lib/dates";
import { SITE_BUCKET } from "@/lib/env";
import { compressImage } from "@/lib/image";
import { PROMO_BG_KEYS, PROMO_BGS, PROMO_IDEAS, promoHref, promoStatus, type PromoBanner, type PromoBg, type PromoLinkKind, type PromoSlide } from "@/lib/promos";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { ActionResult } from "@/lib/types";
import { createPromo, deletePromo, movePromo, setPromoActive, updatePromo } from "./actions";

export type PromoRow = PromoBanner & { imageUrl: string | null };
type Options = { categories: string[]; products: { slug: string; name: string }[] };

type Draft = {
  badge: string; headline: string; subtext: string; bg: PromoBg;
  link_kind: PromoLinkKind; link_value: string;
  starts_at: string; ends_at: string; is_active: boolean;
};

const blank: Draft = { badge: "", headline: "", subtext: "", bg: "red", link_kind: "none", link_value: "", starts_at: "", ends_at: "", is_active: true };

function fromRow(b: PromoRow): Draft {
  return {
    badge: b.badge ?? "", headline: b.headline ?? "", subtext: b.subtext ?? "", bg: b.bg,
    link_kind: b.link_kind, link_value: b.link_value ?? "",
    starts_at: toManilaInput(b.starts_at), ends_at: toManilaInput(b.ends_at), is_active: b.is_active,
  };
}

function PromoForm({ row, options, onDone }: { row?: PromoRow; options: Options; onDone: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [d, setD] = useState<Draft>(row ? fromRow(row) : blank);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));

  const currentImage = preview ?? (removeImage ? null : (row?.imageUrl ?? null));

  function choose(f: File | undefined) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f ?? null);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f) setRemoveImage(false);
  }

  const slide: PromoSlide = {
    id: "preview", badge: d.badge.trim() || null, headline: d.headline.trim() || null, subtext: d.subtext.trim() || null,
    imageUrl: currentImage, bg: d.bg, href: null,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    let uploaded: string | null = null;
    try {
      if (file) {
        const blob = await compressImage(file);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        uploaded = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabaseBrowser().storage.from(SITE_BUCKET).upload(uploaded, blob, { contentType: blob.type, upsert: false });
        if (error) throw error;
      }
      const image_path = uploaded ?? (removeImage ? null : (row?.image_path ?? null));
      const input = { ...d, image_path };
      const res = row ? await updatePromo(row.id, input) : await createPromo(input);
      if (!res.ok && uploaded) await supabaseBrowser().storage.from(SITE_BUCKET).remove([uploaded]);
      setResult(res);
      if (res.ok) {
        router.refresh();
        if (!row) { setD(blank); choose(undefined); if (fileInput.current) fileInput.current.value = ""; }
        else onDone();
      }
    } catch {
      setResult({ ok: false, message: "Couldn't upload the picture. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {!row ? (
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Tap an idea to start (then change the words to match your real offer)</p>
          <div className="flex flex-wrap gap-2">
            {PROMO_IDEAS.map((i) => (
              <button
                key={i.label} type="button"
                onClick={() => setD((cur) => ({ ...cur, badge: i.badge, headline: i.headline, subtext: i.subtext, bg: i.bg }))}
                className="tap min-h-9 rounded-full bg-accent-soft px-3 text-[14px] font-medium text-link"
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-w-md">
        <p className="mb-1.5 text-[13px] font-medium text-muted">Preview</p>
        <PromoCard slide={slide} />
      </div>

      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line p-4">
        <p className="text-[15px] font-medium">Background picture</p>
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
            <ImagePlus size={18} aria-hidden /> {currentImage ? "Change picture" : "Upload background picture"}
          </Button>
          {currentImage ? (
            <Button type="button" variant="secondary" onClick={() => { choose(undefined); setRemoveImage(true); if (fileInput.current) fileInput.current.value = ""; }}>
              <X size={18} aria-hidden /> Remove picture
            </Button>
          ) : null}
        </div>
        <p className="text-[13px] text-muted">Optional. The picture fills the whole card. Best size: wide, about 1200 × 600 (2:1). <strong>Leave the words below blank</strong> to show your picture as it is (for a finished design). Add words and they appear on top of the picture.</p>
      </div>

      <Field label="Small label" name={`badge-${row?.id ?? "new"}`} error={errors.badge} hint="Optional, e.g. 10.10 or PAYDAY (max 24).">
        {(p) => <Input {...p} value={d.badge} maxLength={24} onChange={(e) => set("badge", e.target.value)} />}
      </Field>
      <Field label="Headline" name={`headline-${row?.id ?? "new"}`} error={errors.headline} hint="Max 60. Needed unless you add a picture.">
        {(p) => <Input {...p} value={d.headline} maxLength={60} onChange={(e) => set("headline", e.target.value)} />}
      </Field>
      <Field label="Text under the headline" name={`subtext-${row?.id ?? "new"}`} error={errors.subtext} hint="Optional (max 140).">
        {(p) => <Input {...p} value={d.subtext} maxLength={140} onChange={(e) => set("subtext", e.target.value)} />}
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-[15px] font-medium">Colour {currentImage ? <span className="text-[13px] font-normal text-muted">(used when there&apos;s no picture)</span> : null}</legend>
        <div className="flex gap-2">
          {PROMO_BG_KEYS.map((k) => (
            <button
              key={k} type="button" aria-pressed={d.bg === k} aria-label={PROMO_BGS[k].label} onClick={() => set("bg", k)}
              className={`tap grid size-11 place-items-center rounded-full ${d.bg === k ? "ring-2 ring-ink ring-offset-2" : ""}`}
            >
              <span className={`block size-8 rounded-full ${PROMO_BGS[k].swatch}`} />
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="When tapped, go to" name={`link-${row?.id ?? "new"}`} error={errors.link_value}>
        {(p) => (
          <div className="flex flex-col gap-2">
            <Select {...p} value={d.link_kind} onChange={(e) => { set("link_kind", e.target.value as PromoLinkKind); set("link_value", ""); }}>
              <option value="none">Nowhere (just a notice)</option>
              <option value="category">A category</option>
              <option value="product">A product</option>
            </Select>
            {d.link_kind === "category" ? (
              <Select aria-label="Category" value={d.link_value} onChange={(e) => set("link_value", e.target.value)}>
                <option value="">Choose a category</option>
                {options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            ) : null}
            {d.link_kind === "product" ? (
              <Select aria-label="Product" value={d.link_value} onChange={(e) => set("link_value", e.target.value)}>
                <option value="">Choose a product</option>
                {options.products.map((pr) => <option key={pr.slug} value={pr.slug}>{pr.name}</option>)}
              </Select>
            ) : null}
          </div>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Show from" name={`starts-${row?.id ?? "new"}`} error={errors.starts_at} hint="Optional. Philippine time. Blank = right away.">
          {(p) => <Input {...p} type="datetime-local" value={d.starts_at} onChange={(e) => set("starts_at", e.target.value)} />}
        </Field>
        <Field label="Hide after" name={`ends-${row?.id ?? "new"}`} error={errors.ends_at} hint="Optional. Blank = stays until you hide it.">
          {(p) => <Input {...p} type="datetime-local" value={d.ends_at} onChange={(e) => set("ends_at", e.target.value)} />}
        </Field>
      </div>

      <Toggle name={`active-${row?.id ?? "new"}`} checked={d.is_active} onChange={(v) => set("is_active", v)} label="Show in the shop" description={d.is_active ? "Customers see it (inside its dates)." : "Hidden from customers."} />

      <Notice>Only promise what you&apos;ll really give: a real discount, a real freebie, a real deadline. A made-up price or &quot;only 3 left&quot; can get you reported to the DTI and costs you customers&apos; trust.</Notice>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>{row ? "Save changes" : "Add banner"}</Button>
        {row ? <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button> : null}
      </div>
      {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
    </form>
  );
}

const STATUS_STYLE = {
  live: "bg-success-soft text-success",
  hidden: "bg-sunken text-muted",
  scheduled: "bg-warning-soft text-warning",
  ended: "bg-sunken text-muted",
} as const;
const STATUS_LABEL = { live: "Live", hidden: "Hidden", scheduled: "Scheduled", ended: "Ended" } as const;

function PromoItem({ row, index, total, options }: { row: PromoRow; index: number; total: number; options: Options }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const status = promoStatus(row);
  const slide: PromoSlide = {
    id: row.id, badge: row.badge, headline: row.headline, subtext: row.subtext, imageUrl: row.imageUrl, bg: row.bg, href: null,
  };
  const run = (fn: () => Promise<ActionResult>) => start(async () => { setResult(await fn()); router.refresh(); });

  return (
    <Card className="flex flex-col gap-3 p-4">
      {editing ? (
        <PromoForm row={row} options={options} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="max-w-md"><PromoCard slide={slide} /></div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
            {row.starts_at ? <span>from {formatDateTime(row.starts_at)}</span> : null}
            {row.ends_at ? <span>until {formatDateTime(row.ends_at)}</span> : null}
            {promoHref(row.link_kind, row.link_value) ? <span>→ {row.link_kind === "category" ? `category “${row.link_value}”` : `product “${row.link_value}”`}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} aria-hidden /> Edit</Button>
            <Button type="button" variant="secondary" loading={pending} onClick={() => run(() => setPromoActive(row.id, !row.is_active))}>
              {row.is_active ? <><EyeOff size={16} aria-hidden /> Hide</> : <><Eye size={16} aria-hidden /> Show</>}
            </Button>
            <button type="button" aria-label="Move up" disabled={pending || index === 0} onClick={() => run(() => movePromo(row.id, "up"))} className="tap grid size-12 place-items-center rounded-full bg-sunken disabled:opacity-40"><ArrowUp size={18} aria-hidden /></button>
            <button type="button" aria-label="Move down" disabled={pending || index === total - 1} onClick={() => run(() => movePromo(row.id, "down"))} className="tap grid size-12 place-items-center rounded-full bg-sunken disabled:opacity-40"><ArrowDown size={18} aria-hidden /></button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => { if (confirm("Delete this banner? This can't be undone.")) run(() => deletePromo(row.id)); }}>
              <Trash2 size={16} aria-hidden /> Delete
            </Button>
          </div>
          {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
        </>
      )}
    </Card>
  );
}

export function PromoManager({ rows, options }: { rows: PromoRow[]; options: Options }) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-[22px]">Add a banner</h2>
        <PromoForm options={options} onDone={() => {}} />
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Your banners · {rows.length}</h2>
        {rows.length === 0 ? <p className="px-1 text-[15px] text-muted">None yet. The shop shows no banner strip until you add one.</p> : null}
        {rows.map((r, i) => <PromoItem key={r.id} row={r} index={i} total={rows.length} options={options} />)}
      </div>
    </div>
  );
}
