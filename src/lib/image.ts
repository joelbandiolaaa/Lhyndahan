"use client";

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * Shrinks a phone photo (often 4–8 MB) to ≤1600px WebP (~150–300 KB) before
 * upload. Keeps the store fast on cheap phones and inside Supabase's free 1 GB.
 * Falls back to JPEG on browsers that can't encode WebP.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("This file is not an image.");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image on this device.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Couldn't save the image. Please try again.");
  return jpeg;
}
