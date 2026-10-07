import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import type { ProductWithImages } from "@/lib/types";
import { ImageManager } from "../image-manager";
import { ProductForm } from "../product-form";

export default async function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const { created } = await props.searchParams;
  const { supabase } = await requireAdmin();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) notFound();

  const { data: cats } = await supabase.from("categories").select("name").order("sort_order").order("created_at");
  const product = data as ProductWithImages;
  const images = [...product.product_images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/products" className="tap -ml-2 flex min-h-11 items-center gap-0.5 self-start px-2 text-[17px] text-link">
        <ChevronLeft size={20} aria-hidden /> Products
      </Link>
      <h1 className="font-display text-[34px] leading-tight">{product.name}</h1>
      {created ? <Notice tone="success">Saved! You can now upload photos below.</Notice> : null}

      <ImageManager productId={product.id} productName={product.name} images={images} />
      <ProductForm product={product} categories={(cats ?? []).map((c) => c.name)} />
    </div>
  );
}
