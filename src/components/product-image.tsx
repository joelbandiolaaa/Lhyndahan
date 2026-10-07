/* eslint-disable @next/next/no-img-element --
   Images are already resized to ≤1600px WebP on upload, and plain <img> works the
   same on every free host without image-optimizer quotas. */
import { PRODUCT_BUCKET, publicStorageUrl } from "@/lib/env";

/** "Hopia Monggo x10" → "HM". Skips size tokens like "x10" and symbols. */
function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^x$/i.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function ProductImg({
  path,
  alt,
  name,
  className = "",
  priority = false,
}: {
  path?: string | null;
  alt: string;
  /** Used for the placeholder when there is no photo yet. */
  name?: string;
  className?: string;
  priority?: boolean;
}) {
  if (!path) {
    // Branded placeholder until a real photo is uploaded.
    return (
      <div
        role="img"
        aria-label={name ? `${name} (no photo yet)` : "No photo yet"}
        className={`flex items-center justify-center bg-sunken text-muted ${className}`}
      >
        <span aria-hidden className="font-display text-[1.4em] leading-none">
          {name ? initials(name) : "?"}
        </span>
      </div>
    );
  }
  return (
    <img
      src={publicStorageUrl(PRODUCT_BUCKET, path)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`bg-sunken object-cover ${className}`}
    />
  );
}
