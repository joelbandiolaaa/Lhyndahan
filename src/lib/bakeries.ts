import { BAKERIES } from "@/lib/types";

/** Admin-only: who to text for each bakery. Never shown on the public shop. */
export const BAKERY_CONTACT: Record<string, string> = {
  Ribbonets: "Look for Kwin · Globe 0917 713 8921 · Smart 0961 512 1241",
  Momsue: "Look for Kwin · Globe 0917 713 8921 · Smart 0961 512 1241",
  "Sweet Cassie's": "0955 634 8863 · reserve one day before pickup",
  "D' Original": "Pickup only, no number",
};

const ORDER: string[] = [...BAKERIES, "Other"];

/** Groups rows by bakery, in the same order as the bakery list (Other last). */
export function groupByBakery<T extends { bakery: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.bakery, [...(map.get(r.bakery) ?? []), r]);
  return [...map.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
}

/** The text to paste to one bakery: only that bakery's products. */
export function supplierMessage(lines: { name: string; qty: number }[], day?: string): string {
  const pieces = lines.reduce((n, l) => n + l.qty, 0);
  return [day ? `Hi! Order for ${day}:` : "Hi! Order:", "", ...lines.map((l) => `${l.name} x ${l.qty}`), "", `Total: ${pieces} pcs`, "Thank you!"].join("\n");
}
