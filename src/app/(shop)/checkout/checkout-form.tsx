"use client";

/* eslint-disable @next/next/no-img-element -- GCash QR is a small uploaded image */
import { Building2, Check, LocateFixed, MapPin, NotebookPen, Truck, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, EmptyState, Notice } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cartTotal, clearCart, useCart } from "@/lib/cart";
import { formatCutoff, formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { addressField, landmarkField, orderSchema, type OrderResult } from "@/lib/order-schema";
import type { BatchPreview } from "@/lib/shop";

type Details = {
  name: string;
  phone: string;
  delivery_type: "" | "office" | "outside";
  address: string;
  landmark: string;
  map_url: string;
  notes: string;
  payment_method: "" | "cod" | "gcash";
};

const SAVED_KEY = "hopia-details-v1";
const EMPTY: Details = {
  name: "", phone: "", delivery_type: "", address: "", landmark: "", map_url: "", notes: "", payment_method: "",
};
const FIELD_ORDER: (keyof Details)[] = ["name", "phone", "delivery_type", "address", "landmark", "map_url", "payment_method", "notes"];

export function CheckoutForm({
  batch,
  gcash,
}: {
  batch: BatchPreview | null;
  gcash: { qrUrl: string | null; name: string | null; number: string | null };
}) {
  const router = useRouter();
  const lines = useCart();
  const [d, setD] = useState<Details>(EMPTY);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const [placed, setPlaced] = useState(false);

  // Repeat customers: fill in what they used last time (saved on this phone only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage
      if (saved) setD((cur) => ({ ...cur, ...JSON.parse(saved), notes: "" }));
    } catch {
      /* ignore */
    }
  }, []);

  const set = <K extends keyof Details>(k: K, v: Details[K]) => {
    setD((cur) => ({ ...cur, [k]: v }));
    setFormError(null);
    if (errors[k]) {
      setErrors((cur) => {
        const next = { ...cur };
        delete next[k];
        return next;
      });
    }
  };

  function validateField(k: keyof Details) {
    const shape =
      k === "address" ? addressField : k === "landmark" ? landmarkField : orderSchema.shape[k as keyof typeof orderSchema.shape];
    if (!shape) return;
    const r = shape.safeParse(d[k]);
    setErrors((cur) => {
      const next = { ...cur };
      delete next[k];
      return r.success ? next : { ...next, [k]: r.error.issues[0].message };
    });
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setErrors((e) => ({ ...e, map_url: "Your phone or browser doesn't support location. Please paste a Google Maps link instead." }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        set("map_url", `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setErrors((e) => ({
          ...e,
          map_url: "We couldn't get your location. Allow location access in your browser, or paste a Google Maps link.",
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...d,
      items: lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
      website: honeypot.current?.value ?? "",
    };
    const parsed = orderSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[String(issue.path[0])] ??= issue.message;
      setErrors(fe);
      setFormError("Something is missing or incorrect. Please check the fields in red.");
      const first = FIELD_ORDER.find((k) => fe[k]);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ({ ok: true } & OrderResult) | { ok: false; message: string; fieldErrors?: Record<string, string> };
      if (!json.ok) {
        setFormError(json.message);
        if (json.fieldErrors) setErrors(json.fieldErrors);
        setSubmitting(false);
        return;
      }
      try {
        if (remember) {
          localStorage.setItem(SAVED_KEY, JSON.stringify({ ...d, notes: "" }));
        } else {
          localStorage.removeItem(SAVED_KEY);
        }
        sessionStorage.setItem(`hopia-order:${json.code}`, JSON.stringify({ phone: parsed.data.phone, result: json }));
      } catch {
        /* ignore */
      }
      setPlaced(true);
      clearCart();
      router.push(`/order/${json.code}`);
    } catch {
      setFormError("No internet or a connection problem. Please try again.");
      setSubmitting(false);
    }
  }

  if (lines.length === 0 && !placed && !submitting) {
    return (
      <EmptyState
        title="Your cart is empty"
        action={
          <Link href="/" className={buttonClass("primary")}>
            Go to shop
          </Link>
        }
      />
    );
  }

  const total = cartTotal(lines);

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-6">
      {/* Order summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Your order</h2>
          <Link href="/cart" className="text-[15px] text-link">
            Edit
          </Link>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-[15px]">
          {lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-3">
              <span className="text-muted">
                <span className="num">{l.qty}×</span> {l.name}
              </span>
              <span className="num shrink-0">{formatPeso(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-black/[0.08] pt-3">
          <span className="text-[15px] text-muted">Total · Delivery included</span>
          <span className="num text-[20px] font-semibold">{formatPeso(total)}</span>
        </div>
      </Card>

      {/* Contact */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4">
        <SectionTitle icon={<UserRound size={20} strokeWidth={1.8} aria-hidden />}>About you</SectionTitle>
        <Field label="Name" name="name" required error={errors.name}>
          {(p) => (
            <Input {...p} name="name" autoComplete="name" value={d.name}
              onChange={(e) => set("name", e.target.value)} onBlur={() => validateField("name")} />
          )}
        </Field>
        <Field label="Mobile number" name="phone" required error={errors.phone} hint="We'll message or call you on this number.">
          {(p) => (
            <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567"
              value={d.phone} onChange={(e) => set("phone", e.target.value)} onBlur={() => validateField("phone")} />
          )}
        </Field>
      </section>

      {/* Delivery */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4">
        <SectionTitle icon={<Truck size={20} strokeWidth={1.8} aria-hidden />}>Delivery</SectionTitle>
        <fieldset aria-describedby={errors.delivery_type ? "f-delivery_type-err" : undefined}>
          <legend className="sr-only">Delivery</legend>
          <div id="f-delivery_type" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">
            <Choice
              name="delivery_type" value="office" checked={d.delivery_type === "office"}
              onChange={() => set("delivery_type", "office")}
              icon={<Building2 size={22} strokeWidth={1.6} aria-hidden />}
              title="KUS Delivery"
              detail={batch ? `Arrives ${formatDay(batch.office_date)}` : "Arrives Friday"}
            />
            <Choice
              name="delivery_type" value="outside" checked={d.delivery_type === "outside"}
              onChange={() => set("delivery_type", "outside")}
              icon={<MapPin size={22} strokeWidth={1.6} aria-hidden />}
              title="My address"
              detail={batch ? `Arrives ${formatDay(batch.outside_date)}` : "Arrives Saturday"}
            />
          </div>
          {errors.delivery_type ? (
            <p id="f-delivery_type-err" role="alert" className="mt-1.5 text-sm text-danger">{errors.delivery_type}</p>
          ) : null}
        </fieldset>
        {batch ? (
          <p className="-mt-1 text-[13px] text-muted">
            Orders placed until {formatCutoff(batch.cutoff_at)} are included in this batch.
          </p>
        ) : null}

        {d.delivery_type === "office" ? (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-[15px] text-ink">
            No address needed. We&apos;ll deliver to KUS.
          </p>
        ) : null}

        {d.delivery_type === "outside" ? (
          <>
        <Field
          label="Address"
          name="address" required error={errors.address}
          hint="House/unit no., street, barangay, city."
        >
          {(p) => (
            <Textarea {...p} name="address" autoComplete="street-address" rows={2} className="min-h-20"
              value={d.address} onChange={(e) => set("address", e.target.value)} onBlur={() => validateField("address")} />
          )}
        </Field>
        <Field label="Landmark" name="landmark" required error={errors.landmark} hint="E.g. across from the church, beside 7-Eleven, green gate.">
          {(p) => (
            <Input {...p} name="landmark" value={d.landmark}
              onChange={(e) => set("landmark", e.target.value)} onBlur={() => validateField("landmark")} />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <Field
            label="Google Maps pin"
            name="map_url"
            error={errors.map_url}
            hint={d.map_url ? undefined : "Optional, but it helps us find you faster."}
          >
            {(p) =>
              d.map_url && !errors.map_url ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                  <Check size={18} className="shrink-0 text-success" aria-hidden />
                  <a href={d.map_url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[15px] text-link">
                    Location saved
                  </a>
                  <button type="button" onClick={() => set("map_url", "")} className="text-[15px] text-muted">
                    Remove
                  </button>
                </div>
              ) : (
                <Input {...p} name="map_url" type="url" inputMode="url" placeholder="Paste a Google Maps link"
                  value={d.map_url} onChange={(e) => set("map_url", e.target.value)} onBlur={() => validateField("map_url")} />
              )
            }
          </Field>
          {!d.map_url ? (
            <Button type="button" variant="secondary" onClick={locateMe} loading={locating} className="self-start">
              <LocateFixed size={18} aria-hidden /> {locating ? "Getting your location…" : "Use my location"}
            </Button>
          ) : null}
        </div>
          </>
        ) : null}
      </section>

      {/* Payment */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4">
        <SectionTitle icon={<Wallet size={20} strokeWidth={1.8} aria-hidden />}>Payment</SectionTitle>
        <fieldset>
          <legend className="sr-only">Payment</legend>
          <div id="f-payment_method" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">
            <Choice name="payment_method" value="cod" checked={d.payment_method === "cod"}
              onChange={() => set("payment_method", "cod")} title="Cash on Delivery" detail="Pay when your order arrives" />
            <Choice name="payment_method" value="gcash" checked={d.payment_method === "gcash"}
              onChange={() => set("payment_method", "gcash")} title="GCash" detail="Pay before delivery" />
          </div>
          {errors.payment_method ? <p role="alert" className="mt-1.5 text-sm text-danger">{errors.payment_method}</p> : null}
        </fieldset>

        {d.payment_method === "gcash" ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-bg p-5 text-center">
            {gcash.qrUrl ? (
              <img src={gcash.qrUrl} alt="GCash QR code" className="w-56 max-w-full rounded-xl" />
            ) : null}
            {gcash.name || gcash.number ? (
              <p className="text-[15px]">
                {gcash.name}
                {gcash.number ? <span className="num block text-[17px] font-semibold">{gcash.number}</span> : null}
              </p>
            ) : null}
            <p className="text-[15px] text-muted">
              {gcash.qrUrl || gcash.number
                ? "Pay the exact total. After placing your order, screenshot your payment and send it to us on Messenger with your order number."
                : "We'll send you the GCash details on Messenger. After paying, screenshot your payment and send it with your order number."}
            </p>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <SectionTitle icon={<NotebookPen size={20} strokeWidth={1.8} aria-hidden />}>Notes for the rider</SectionTitle>
      <Field label="Notes" name="notes" error={errors.notes} hint="Optional. E.g. please call before arriving.">
        {(p) => (
          <Textarea {...p} name="notes" rows={2} className="min-h-20" maxLength={500}
            value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        )}
      </Field>
      </section>

      {/* Honeypot for bots: hidden from people and screen readers */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
        Remember my details on this phone
      </label>

      {formError ? <Notice tone="error">{formError}</Notice> : null}

      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? "Placing your order…" : <>Place order · <span className="num">{formatPeso(total)}</span></>}
      </Button>
      <p className="-mt-3 text-center text-[13px] text-muted">This is a pre-order. We&apos;ll confirm your order on Messenger.</p>
    </form>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[17px] font-semibold">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-link">{icon}</span>
      {children}
    </h2>
  );
}

function Choice({
  name, value, checked, onChange, title, detail, icon,
}: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string; detail: string; icon?: React.ReactNode;
}) {
  return (
    <label
      className={`tap flex min-h-16 cursor-pointer items-center gap-3 rounded-xl bg-surface px-4 py-3 transition-shadow has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
        checked ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-line)]"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {icon ? <span className={checked ? "text-accent" : "text-muted"}>{icon}</span> : null}
      <span className="flex flex-1 flex-col">
        <span className="text-[17px]">{title}</span>
        <span className="text-[13px] text-muted">{detail}</span>
      </span>
      <span
        aria-hidden
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${checked ? "bg-accent text-accent-ink" : "shadow-[inset_0_0_0_1.5px_var(--color-line)]"}`}
      >
        {checked ? <Check size={14} strokeWidth={3} /> : null}
      </span>
    </label>
  );
}
