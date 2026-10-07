"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/field";
import { formatPeso, profitPerPiece } from "@/lib/money";
import { BAKERIES, CATEGORY_SUGGESTIONS, type ActionResult, type Product } from "@/lib/types";
import type { ProductInput } from "@/lib/validators";
import { createProduct, deleteProduct, updateProduct } from "./actions";

type Draft = Omit<ProductInput, "supplier_price" | "selling_price" | "delivery_markup"> & {
  supplier_price: string;
  selling_price: string;
  delivery_markup: string;
};

export function ProductForm({ product }: { product?: Product }) {
  const [draft, setDraft] = useState<Draft>({
    name: product?.name ?? "",
    bakery: product?.bakery ?? "Ribbonets",
    category: product?.category ?? CATEGORY_SUGGESTIONS[0],
    description: product?.description ?? "",
    supplier_price: product?.supplier_price != null ? String(product.supplier_price) : "",
    selling_price: product ? String(product.selling_price) : "",
    delivery_markup: product ? String(product.delivery_markup) : "10",
    is_active: product?.is_active ?? false,
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const profit = profitPerPiece({
    selling_price: Number(draft.selling_price || 0),
    delivery_markup: Number(draft.delivery_markup || 0),
    supplier_price: draft.supplier_price === "" ? null : Number(draft.supplier_price),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      ...draft,
      supplier_price: draft.supplier_price === "" ? null : Number(draft.supplier_price),
      selling_price: Number(draft.selling_price),
      delivery_markup: Number(draft.delivery_markup),
    } as ProductInput;
    if (draft.selling_price === "" || draft.delivery_markup === "") {
      setResult({ ok: false, message: "Please fill in the prices.", fieldErrors: {
        ...(draft.selling_price === "" && { selling_price: "Enter the selling price." }),
        ...(draft.delivery_markup === "" && { delivery_markup: "Enter the delivery markup (default 10)." }),
      } });
      return;
    }
    startSave(async () => {
      const res = product ? await updateProduct(product.id, input) : await createProduct(input);
      setResult(res ?? null);
    });
  }

  function remove() {
    if (!product) return;
    if (!confirm(`Delete "${product.name}"? It will be removed from the store. Past orders won't be affected.`)) return;
    startDelete(async () => {
      const res = await deleteProduct(product.id);
      setResult(res ?? null);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5 p-5">
        <h2 className="font-display text-xl">Details</h2>
        <Field label="Product name" name="name" required error={errors.name}>
          {(p) => <Input {...p} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />}
        </Field>
        <Field label="Bakery" name="bakery" required error={errors.bakery}>
          {(p) => (
            <Select {...p} value={draft.bakery} onChange={(e) => set("bakery", e.target.value as Draft["bakery"])}>
              {BAKERIES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Category" name="category" required error={errors.category} hint="Used to group products in the shop. Pick one or type a new one.">
          {(p) => (
            <>
              <Input {...p} list="category-options" value={draft.category} onChange={(e) => set("category", e.target.value)} maxLength={40} />
              <datalist id="category-options">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Description" name="description" error={errors.description} hint="Flavor, what's in the box, number of pieces, etc.">
          {(p) => (
            <Textarea {...p} value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
          )}
        </Field>
      </Card>

      <Card className="flex flex-col gap-5 p-5">
        <h2 className="font-display text-xl">Pricing</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <MoneyField label="Supplier price" name="supplier_price" value={draft.supplier_price} optional
            onChange={(v) => set("supplier_price", v)} error={errors.supplier_price} hint="What you pay the supplier. Can be left blank for now." />
          <MoneyField label="Selling price" name="selling_price" value={draft.selling_price}
            onChange={(v) => set("selling_price", v)} error={errors.selling_price} hint="Shown to customers" />
          <MoneyField label="Delivery markup" name="delivery_markup" value={draft.delivery_markup}
            onChange={(v) => set("delivery_markup", v)} error={errors.delivery_markup} hint="Already included in the selling price" />
        </div>
        <div className={`num flex items-baseline justify-between rounded-2xl px-4 py-3 ${profit !== null && profit < 0 ? "bg-danger-soft" : "bg-sunken"}`}>
          <span className="text-[15px]">Profit per piece</span>
          {profit === null ? (
            <span className="text-[15px] text-muted">Enter the supplier price</span>
          ) : (
            <span className={`text-xl font-semibold ${profit < 0 ? "text-danger" : "text-ink"}`}>{formatPeso(profit)}</span>
          )}
        </div>
        <p className="-mt-2 text-sm text-muted">= selling − delivery markup − supplier. This is used in all profit totals.</p>
      </Card>

      <Card className="p-5">
        <Toggle
          name="is_active"
          checked={draft.is_active}
          onChange={(v) => set("is_active", v)}
          label="Show in store"
          description={draft.is_active ? "Visible and can be ordered." : "Hidden from customers."}
        />
      </Card>

      {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-3 md:bottom-4">
        <Button type="submit" size="lg" loading={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Save and add photos"}
        </Button>
      </div>

      {product ? (
        <Button type="button" variant="danger" onClick={remove} loading={deleting} className="self-center">
          Delete product
        </Button>
      ) : null}
    </form>
  );
}

function MoneyField({
  label, name, value, onChange, error, hint, optional = false,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; optional?: boolean;
}) {
  return (
    <Field label={label} name={name} required={!optional} error={error} hint={hint}>
      {(p) => (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">₱</span>
          <Input
            {...p}
            className="num pl-8"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
          />
        </div>
      )}
    </Field>
  );
}
