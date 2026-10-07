import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/products" className="tap -ml-2 flex min-h-11 items-center gap-0.5 self-start px-2 text-[17px] text-link">
        <ChevronLeft size={20} aria-hidden /> Products
      </Link>
      <h1 className="font-display text-[34px] leading-tight">New product</h1>
      <p className="-mt-3 text-muted">After saving, you can upload photos.</p>
      <ProductForm />
    </div>
  );
}
