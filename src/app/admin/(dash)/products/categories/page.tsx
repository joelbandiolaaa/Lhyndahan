import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order").order("created_at"),
    supabase.from("products").select("category").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const p of prods ?? []) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/products" className="tap -ml-2 flex min-h-11 items-center gap-0.5 self-start px-2 text-[17px] text-link">
        <ChevronLeft size={20} aria-hidden /> Products
      </Link>
      <h1 className="font-display text-[34px] leading-tight">Categories</h1>
      <p className="-mt-3 text-muted">
        These are the sections customers see in the shop, in this order. Renaming one renames it on all its products.
      </p>
      <CategoryManager categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name, count: counts.get(c.name) ?? 0 }))} />
    </div>
  );
}
