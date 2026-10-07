import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { ProductImg } from "@/components/product-image";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import type { ProductWithImages } from "@/lib/types";

export default async function ProductsPage(props: PageProps<"/admin/products">) {
  const { deleted } = await props.searchParams;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .is("deleted_at", null)
    .order("category")
    .order("sort_order")
    .order("created_at");

  const products = (data ?? []) as ProductWithImages[];
  const groups = new Map<string, ProductWithImages[]>();
  for (const p of [...products].sort((a, b) => a.sort_order - b.sort_order)) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  }
  const missingSupplier = products.filter((p) => p.supplier_price === null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[34px] leading-tight">Products</h1>
        <ButtonLink href="/admin/products/new">
          <Plus size={18} aria-hidden /> New product
        </ButtonLink>
      </div>

      {deleted ? <Notice tone="success">Product deleted.</Notice> : null}
      {missingSupplier > 0 ? (
        <Notice>
          <span className="num font-semibold">{missingSupplier}</span> product(s) have no supplier price yet. Profit totals
          will be incomplete until you add it.
        </Notice>
      ) : null}
      {error ? <Notice tone="error">Couldn&apos;t load products. Please refresh the page.</Notice> : null}

      {!error && products.length === 0 ? (
        <EmptyState
          title="No products yet"
          body="Add your first product so customers can see it."
          action={<ButtonLink href="/admin/products/new">Add product</ButtonLink>}
        />
      ) : null}

      {[...groups.entries()].map(([category, items]) => (
        <section key={category} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-medium tracking-wide text-muted uppercase">
            {category} <span className="num">· {items.length}</span>
          </h2>
          <ul className="flex flex-col divide-y divide-black/[0.08] overflow-hidden rounded-[var(--radius-card)] bg-surface">
            {items.map((p) => {
              const primary = p.product_images.find((i) => i.is_primary) ?? p.product_images[0];
              return (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="tap flex items-center gap-4 p-3 hover:bg-black/[0.03]">
                    <ProductImg path={primary?.path} alt="" name={p.name} sizes="64px" className="size-16 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px]">{p.name}</p>
                      <p className="num text-sm text-muted">
                        {formatPeso(p.selling_price)}
                        {p.profit_per_piece !== null ? ` · profit ${formatPeso(p.profit_per_piece)}/pc` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.is_active ? "bg-success-soft text-success" : "bg-sunken text-muted"
                          }`}
                        >
                          {p.is_active ? "Live" : "Hidden"}
                        </span>
                        {p.supplier_price === null ? (
                          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                            No supplier price
                          </span>
                        ) : null}
                        {p.profit_per_piece !== null && p.profit_per_piece < 0 ? (
                          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Loss</span>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
