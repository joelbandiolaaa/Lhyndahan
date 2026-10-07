export const BAKERIES = ["Ribbonets", "RSF Bakery", "D' Original", "Edson Hopia Tipas"] as const;
export type Bakery = (typeof BAKERIES)[number];

/** Suggestions only; any category name can be typed in the form. */
export const CATEGORY_SUGGESTIONS = [
  "Hopia / Sweets",
  "Sweet Cassie",
  "Crinkles",
  "Polvoron",
  "Cheesecake",
  "Cheese Bulilit",
];

export type Product = {
  id: string;
  slug: string;
  name: string;
  bakery: Bakery;
  category: string;
  description: string;
  /** null = not set yet (profit unknown), never treated as ₱0 */
  supplier_price: number | null;
  selling_price: number;
  delivery_markup: number;
  profit_per_piece: number | null;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  path: string;
  sort_order: number;
  is_primary: boolean;
};

export type ProductWithImages = Product & { product_images: ProductImage[] };

/** Form/action result shape shared by server actions. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
