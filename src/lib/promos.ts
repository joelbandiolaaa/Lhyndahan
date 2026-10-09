/** Shared bits for the promo banners (the sliding cards at the top of the shop). */

export const PROMO_BGS = {
  red: { label: "Red", card: "bg-accent text-white", chip: "bg-white/20 text-white", swatch: "bg-accent" },
  dark: { label: "Dark", card: "bg-[#2b2b2b] text-white", chip: "bg-white/20 text-white", swatch: "bg-[#2b2b2b]" },
  cream: { label: "Cream", card: "bg-[#fff1d6] text-[#4a2a14]", chip: "bg-[#4a2a14]/10 text-[#4a2a14]", swatch: "bg-[#fff1d6] ring-1 ring-black/10" },
  green: { label: "Green", card: "bg-[#1e7b34] text-white", chip: "bg-white/20 text-white", swatch: "bg-[#1e7b34]" },
} as const;
export type PromoBg = keyof typeof PROMO_BGS;
export const PROMO_BG_KEYS = Object.keys(PROMO_BGS) as PromoBg[];

export type PromoLinkKind = "none" | "category" | "product";

/** A banner as stored (admin view). */
export type PromoBanner = {
  id: string;
  badge: string | null;
  headline: string | null;
  subtext: string | null;
  image_path: string | null;
  bg: PromoBg;
  link_kind: PromoLinkKind;
  link_value: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
};

/** A banner as the shop draws it. */
export type PromoSlide = {
  id: string;
  badge: string | null;
  headline: string | null;
  subtext: string | null;
  imageUrl: string | null;
  bg: PromoBg;
  href: string | null;
};

/** Where the "#" jump links on the home page land (shared with the category tabs). */
export function slugifyCategory(c: string) {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function promoHref(kind: PromoLinkKind, value: string | null): string | null {
  if (!value || kind === "none") return null;
  return kind === "category" ? `/#${slugifyCategory(value)}` : `/p/${encodeURIComponent(value)}`;
}

export type PromoStatus = "live" | "hidden" | "scheduled" | "ended";
export function promoStatus(b: Pick<PromoBanner, "is_active" | "starts_at" | "ends_at">, at: number = Date.now()): PromoStatus {
  if (!b.is_active) return "hidden";
  if (b.starts_at && new Date(b.starts_at).getTime() > at) return "scheduled";
  if (b.ends_at && new Date(b.ends_at).getTime() <= at) return "ended";
  return "live";
}

/** Starting points the owner can tap. They promise nothing: add a real discount or perk yourself. */
export const PROMO_IDEAS: { label: string; badge: string; headline: string; subtext: string; bg: PromoBg }[] = [
  { label: "Payday Friday", badge: "PAYDAY", headline: "Payday Friday treat", subtext: "Sweldo na! Treat yourself and the family. Pre-order for this week's batch.", bg: "red" },
  { label: "Double date (10.10, 11.11…)", badge: "10.10", headline: "Double date, double the sweets", subtext: "Pick your favorites and order before the cutoff.", bg: "dark" },
  { label: "Last call", badge: "LAST CALL", headline: "Order before the cutoff", subtext: "Orders close soon. Pre-order now for Friday and Saturday delivery.", bg: "red" },
  { label: "Merienda ng weekend", badge: "WEEKEND", headline: "Merienda for the weekend", subtext: "Fresh hopia, crinkles and polvoron delivered Friday and Saturday.", bg: "cream" },
  { label: "Pasalubong / handaan", badge: "PASALUBONG", headline: "Pasalubong na, handaan pa", subtext: "Planning a get-together? Pre-order in bulk.", bg: "green" },
  { label: "Bagong flavor", badge: "NEW", headline: "New on the menu", subtext: "Try our newest flavor this week.", bg: "dark" },
];
