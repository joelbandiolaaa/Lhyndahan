import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lhyndahan — Hopia & sweets pre-order", template: "%s · Lhyndahan" },
  description: "Pre-order hopia, crinkles, polvoron and more from Lhyndahan. Delivery every Friday and Saturday.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d70f64",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
