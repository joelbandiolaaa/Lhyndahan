function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See README → "Environment variables".`);
  }
  return value;
}

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const PRODUCT_BUCKET = "product-images";
export const SITE_BUCKET = "site";

export function publicStorageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
