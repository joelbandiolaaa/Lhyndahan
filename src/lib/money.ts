const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPeso(value: number | string | null | undefined): string {
  return peso.format(Number(value ?? 0));
}

/**
 * Profit per piece: selling − delivery markup − supplier. Used in every profit total.
 * Returns null while the supplier price is not set, so no fake profit is shown.
 */
export function profitPerPiece(p: {
  selling_price: number;
  delivery_markup: number;
  supplier_price: number | null;
}): number | null {
  if (p.supplier_price === null) return null;
  return round2(Number(p.selling_price) - Number(p.delivery_markup) - Number(p.supplier_price));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
