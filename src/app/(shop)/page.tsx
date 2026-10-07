import { Clock, Truck } from "lucide-react";
import Link from "next/link";
import { ProductImg } from "@/components/product-image";
import { AddButton } from "@/components/shop/add-button";
import { CategoryNav } from "@/components/shop/category-nav";
import { EmptyState } from "@/components/ui/card";
import { formatCutoff, formatDay } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { getBatchPreview, getShopProducts, groupByCategory, primaryImage } from "@/lib/shop";

// Refresh at least every minute (dates move); admin edits refresh it instantly.
export const revalidate = 60;

function slugifyCategory(c: string) {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default async function ShopHome() {
  const [products, batch] = await Promise.all([getShopProducts(), getBatchPreview()]);
  const groups = groupByCategory(products);

  return (
    <main className="mx-auto w-full max-w-5xl bg-surface px-4 pb-8 md:my-4 md:rounded-[var(--radius-card)]">
      {/* Store header */}
      <section className="pt-5 pb-4">
        <h1 className="sr-only">Lhyndahan</h1>
        <p className="text-[13px] font-semibold tracking-wide text-link uppercase">This week&apos;s batch</p>
        <p className="mt-1 text-[22px] leading-tight font-semibold md:text-[26px]">Fresh hopia &amp; sweets, pre-order only</p>
        <ul className="mt-3 flex flex-col gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[15px] text-muted">
          <li className="flex items-center gap-2.5">
            <Clock size={18} className="shrink-0 text-link" aria-hidden />
            {batch ? (
              <span>
                Order by <span className="font-semibold text-ink">{formatCutoff(batch.cutoff_at)}</span>
              </span>
            ) : (
              <span>
                Order by <span className="font-semibold text-ink">Wednesday, 11:59 PM</span>
              </span>
            )}
          </li>
          <li className="flex items-center gap-2.5">
            <Truck size={18} className="shrink-0 text-link" aria-hidden />
            {batch ? (
              <span>
                Delivery <span className="font-semibold text-ink">{formatDay(batch.office_date)}</span> (KUS) or{" "}
                <span className="font-semibold text-ink">{formatDay(batch.outside_date)}</span>
              </span>
            ) : (
              <span>Delivery Friday (KUS) or Saturday</span>
            )}
          </li>
        </ul>
      </section>

      <CategoryNav categories={groups.map(([category]) => ({ id: slugifyCategory(category), label: category }))} />

      {groups.length === 0 ? (
        <EmptyState title="No products yet" body="Check back soon. We're still setting up this week's menu." />
      ) : null}

      {groups.map(([category, items], gi) => (
        <section key={category} id={slugifyCategory(category)} className="scroll-mt-[7rem] pt-6">
          <h2 className="font-display text-[22px] leading-tight">{category}</h2>
          <p className="text-[13px] text-muted">{items.length} {items.length === 1 ? "item" : "items"}</p>
          <ul className="mt-2 grid divide-y divide-line md:grid-cols-2 md:gap-x-8 md:divide-y-0">
            {items.map((p, idx) => {
              const img = primaryImage(p);
              return (
                <li key={p.id} className="md:border-b md:border-line">
                  <Link href={`/p/${p.slug}`} className="tap flex gap-4 py-4">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="text-[16px] leading-snug font-semibold text-ink">{p.name}</h3>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-muted">{p.description}</p>
                      ) : null}
                      <p className="num mt-auto pt-2 text-[16px] text-ink">{formatPeso(p.selling_price)}</p>
                    </div>
                    <div className="relative shrink-0">
                      <ProductImg
                        path={img?.path}
                        name={p.name}
                        alt={p.name}
                        priority={gi === 0 && idx < 4}
                        className="size-28 rounded-xl text-[22px]"
                      />
                      <div className="absolute -right-1.5 -bottom-1.5">
                        <AddButton
                          line={{ productId: p.id, slug: p.slug, name: p.name, price: Number(p.selling_price), imagePath: img?.path ?? null }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

    </main>
  );
}
