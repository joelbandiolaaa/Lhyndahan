import type { NextConfig } from "next";

const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// Next.js needs inline scripts/styles unless nonces are used, so those two stay 'unsafe-inline'.
// Everything else is locked to this site and Supabase (database, login, image storage).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${supabaseOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation stays on for the "Use my location" button at checkout
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

// Product photos come from Supabase Storage; Next resizes them per screen (a 112px thumbnail
// should not download the full 1600px photo). Local QA against a mock server is allowed too.
const isLocalStorage = supabaseOrigin.startsWith("http://localhost");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      ...(isLocalStorage ? [{ protocol: "http" as const, hostname: "localhost", port: "54321", pathname: "/storage/v1/object/public/**" }] : []),
    ],
    dangerouslyAllowLocalIP: isLocalStorage,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // pages with personal data must never be stored by shared caches
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/order/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
