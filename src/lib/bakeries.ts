import { BAKERIES } from "@/lib/types";

/** Bakeries that are ordered from the same contact are texted together. */
const SUPPLIER_OF: Record<string, string> = { Ribbonets: "Ribbonets + Momsue", Momsue: "Ribbonets + Momsue" };

/** Admin-only: who to text for each supplier (see supplierOf). Never shown on the public shop. */
export const BAKERY_CONTACT: Record<string, string> = {
  "Ribbonets + Momsue": "Look for Kwin · Globe 0917 713 8921 · Smart 0961 512 1241",
  "Sweet Cassie's": "0955 634 8863 · reserve one day before pickup",
  "D' Original": "Pickup only, no number",
};

/** Admin-only: the number a text goes to (international format). Missing = no number, so no Text button. */
export const BAKERY_SMS: Record<string, string> = {
  "Ribbonets + Momsue": "+639177138921",
  "Sweet Cassie's": "+639556348863",
};

/** Opens the phone's messaging app with the number and the message already filled in. */
export function smsHref(number: string, text: string): string {
  return `sms:${number}?&body=${encodeURIComponent(text)}`;
}

const ORDER: string[] = [...BAKERIES, "Other"];

/** Groups rows by bakery, in the same order as the bakery list (Other last). */
export function groupByBakery<T extends { bakery: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.bakery, [...(map.get(r.bakery) ?? []), r]);
  return [...map.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
}

/** One block per contact to text (Ribbonets + Momsue share one), products sorted by name inside each. */
export function groupBySupplier<T extends { bakery: string }>(rows: T[], nameOf: (r: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = SUPPLIER_OF[r.bakery] ?? r.bakery;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const rank = (rs: T[]) => Math.min(...rs.map((r) => ORDER.indexOf(r.bakery)));
  return [...map.entries()]
    .map(([k, rs]): [string, T[]] => [k, [...rs].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))])
    .sort((a, b) => rank(a[1]) - rank(b[1]));
}

/** The text to paste to one bakery: only that bakery's products. */
export function supplierMessage(lines: { name: string; qty: number }[], day?: string): string {
  const pieces = lines.reduce((n, l) => n + l.qty, 0);
  return [day ? `Hi! Order for ${day}:` : "Hi! Order:", "", ...lines.map((l) => `${l.name} x ${l.qty}`), "", `Total: ${pieces} pcs`, "Thank you!"].join("\n");
}
