import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lhyndahan.vercel.app"),
  title: { default: "Lhyndahan — Hopia & sweets pre-order", template: "%s · Lhyndahan" },
  description: "Pre-order hopia, crinkles, polvoron and more from Lhyndahan. Delivery every Friday and Saturday.",
  openGraph: {
    type: "website",
    siteName: "Lhyndahan",
    locale: "en_PH",
    title: "Lhyndahan — Hopia & sweets pre-order",
    description: "Pre-order hopia, crinkles, polvoron and more. Order cutoff Wednesday 6 AM, delivery Friday and Saturday.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e9082f",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
