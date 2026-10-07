import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImg } from "@/components/product-image";
import { formatPeso } from "@/lib/money";
import { primaryImage, supabasePublic } from "@/lib/shop";
import type { ProductWithImages } from "@/lib/types";
import { BuyBox } from "./buy-box";
import { Gallery } from "./gallery";

export const revalidate = 60;

async function getProduct(slug: string) {
  const { data } = await supabasePublic()
    .from("products")
    .select("id, slug, name, bakery, category, description, selling_price, product_images(id, path, sort_order, is_primary)")
    .eq("slug", slug)
    .maybeSingle();
  return data as unknown as ProductWithImages | null;
}

export async function generateMetadata(props: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProduct(slug);
  return p ? { title: p.name, description: `${p.name} · ${formatPeso(p.selling_price)} · Pre-order` } : {};
}

export default async function ProductPage(props: PageProps<"/p/[slug]">) {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const images = [...product.product_images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
  const img = primaryImage(product);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-6 md:pb-12">
      <Link href="/" className="tap -ml-2 flex min-h-11 w-fit items-center gap-0.5 px-2 text-[17px] text-link">
        <ChevronLeft size={20} aria-hidden /> Shop
      </Link>

      <div className="mt-2 grid gap-8 md:grid-cols-2 md:gap-12">
        {images.length > 0 ? (
          <Gallery name={product.name} paths={images.map((i) => i.path)} />
        ) : (
          <ProductImg name={product.name} alt={product.name} className="aspect-square w-full rounded-[var(--radius-card)] text-[56px]" />
        )}

        <div className="flex flex-col">
          <p className="text-[15px] text-muted">{product.category}</p>
          <h1 className="mt-1 font-display text-[32px] leading-tight md:text-[40px]">{product.name}</h1>
          <p className="num mt-3 text-[22px]">{formatPeso(product.selling_price)}</p>
          <p className="mt-1 text-[13px] text-muted">Delivery included.</p>

          {product.description ? (
            <p className="mt-6 text-[17px] leading-relaxed whitespace-pre-line text-ink">{product.description}</p>
          ) : null}

          <BuyBox
            line={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              price: Number(product.selling_price),
              imagePath: img?.path ?? null,
            }}
          />
        </div>
      </div>
    </main>
  );
}
