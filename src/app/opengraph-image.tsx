import { ImageResponse } from "next/og";
import { LOGO_DATA_URL } from "@/lib/logo-data";

export const alt = "Lhyndahan — pre-order hopia & sweets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 56, background: "#e9082f", color: "#fff" }}>
        <img src={LOGO_DATA_URL} width={120} height={120} alt="" style={{ marginBottom: 16, flexShrink: 0 }} />
        <div style={{ fontSize: 28, letterSpacing: 4, opacity: 0.85 }}>PRE-ORDER</div>
        <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }}>Lhyndahan</div>
        <div style={{ fontSize: 40, marginTop: 16, opacity: 0.95 }}>Hopia, crinkles, polvoron &amp; more</div>
        <div style={{ fontSize: 32, marginTop: 36, background: "#fff", color: "#e9082f", padding: "14px 28px", borderRadius: 999, alignSelf: "flex-start" }}>
          Order by Wednesday · Delivery Fri &amp; Sat
        </div>
      </div>
    ),
    size,
  );
}
