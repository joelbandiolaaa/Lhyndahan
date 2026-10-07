"use client";

import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ProductImg } from "@/components/product-image";
import { Button, Spinner } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { PRODUCT_BUCKET } from "@/lib/env";
import { compressImage } from "@/lib/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { ActionResult, ProductImage } from "@/lib/types";
import { addProductImage, deleteProductImage, moveProductImage, setPrimaryImage } from "./actions";

const MAX_IMAGES = 10;

export function ImageManager({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const list = Array.from(files).slice(0, room);
    if (list.length < files.length) {
      setMessage({ tone: "error", text: `Up to ${MAX_IMAGES} photos per product.` });
    } else {
      setMessage(null);
    }
    if (!list.length) return;

    const supabase = supabaseBrowser();
    let failed = 0;
    setUploading({ done: 0, total: list.length });
    for (const [i, file] of list.entries()) {
      try {
        const blob = await compressImage(file);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(PRODUCT_BUCKET)
          .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const res = await addProductImage(productId, path);
        if (!res.ok) throw new Error(res.message);
      } catch {
        failed++;
      }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (failed) setMessage({ tone: "error", text: `${failed} photo(s) could not be uploaded. Please try again.` });
    router.refresh();
  }

  function run(id: string, fn: () => Promise<ActionResult>) {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMessage({ tone: "error", text: res.message });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl">Photos</h2>
        <span className="num text-sm text-muted">
          {images.length}/{MAX_IMAGES}
        </span>
      </div>

      {images.length === 0 ? (
        <p className="text-muted">No photos yet. The first one you upload becomes the main photo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {images.map((img, idx) => (
            <li key={img.id} className="flex items-center gap-3">
              <div className="relative">
                <ProductImg path={img.path} alt={`${productName} photo ${idx + 1}`} name={productName} className="size-20 rounded-xl" />
                {img.is_primary ? (
                  <span className="absolute -top-1.5 -left-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                    Main
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-wrap justify-end gap-1">
                {busyId === img.id ? (
                  <span className="flex size-12 items-center justify-center text-muted">
                    <Spinner />
                  </span>
                ) : (
                  <>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={idx === 0 || !!busyId}
                      onClick={() => run(img.id, () => moveProductImage(img.id, "up"))}>
                      <ArrowUp size={20} aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={idx === images.length - 1 || !!busyId}
                      onClick={() => run(img.id, () => moveProductImage(img.id, "down"))}>
                      <ArrowDown size={20} aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Make main photo" aria-pressed={img.is_primary}
                      disabled={img.is_primary || !!busyId} onClick={() => run(img.id, () => setPrimaryImage(img.id))}>
                      <Star size={20} aria-hidden fill={img.is_primary ? "currentColor" : "none"} className={img.is_primary ? "text-accent" : ""} />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Delete photo" disabled={!!busyId}
                      className="text-danger"
                      onClick={() => {
                        if (confirm("Delete this photo?")) run(img.id, () => deleteProductImage(img.id));
                      }}>
                      <Trash2 size={20} aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        id="product-photos"
        onChange={(e) => onFiles(e.target.files)}
        disabled={!!uploading || images.length >= MAX_IMAGES}
      />
      <Button
        type="button"
        variant="secondary"
        size="lg"
        loading={!!uploading}
        disabled={images.length >= MAX_IMAGES}
        onClick={() => input.current?.click()}
      >
        {uploading ? (
          `Uploading ${uploading.done}/${uploading.total}…`
        ) : (
          <>
            <ImagePlus size={20} aria-hidden /> Upload photos
          </>
        )}
      </Button>
    </Card>
  );
}
