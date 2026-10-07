"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { MAX_QTY } from "@/lib/cart";

/**
 * Food-app quantity control: pink outline circles. With `removable`, the
 * minus turns into a trash icon at 1 so the item can be removed.
 */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  label,
  removable = false,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  label: string;
  removable?: boolean;
}) {
  const atMin = value <= min;
  const showTrash = removable && value <= 1;
  const circle =
    "tap flex size-9 items-center justify-center rounded-full border-[1.5px] border-accent text-link disabled:border-line disabled:text-muted/50";
  return (
    <div role="group" aria-label={`Quantity of ${label}`} className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={atMin && !showTrash}
        aria-label={showTrash ? `Remove ${label}` : "Decrease"}
        className={circle}
      >
        {showTrash ? <Trash2 size={16} strokeWidth={1.8} aria-hidden /> : <Minus size={16} strokeWidth={2} aria-hidden />}
      </button>
      <span className="num min-w-5 text-center text-[16px] font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label="Increase" className={circle}>
        <Plus size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
