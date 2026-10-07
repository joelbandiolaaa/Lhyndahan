import { ImageResponse } from "next/og";

export const alt = "Lhyndahan — pre-order hopia & sweets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#d70f64", color: "#fff" }}>
        <div style={{ fontSize: 28, letterSpacing: 4, opacity: 0.85 }}>PRE-ORDER</div>
        <div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1.05, marginTop: 12 }}>Lhyndahan</div>
        <div style={{ fontSize: 44, marginTop: 24, opacity: 0.95 }}>Hopia, crinkles, polvoron &amp; more</div>
        <div style={{ fontSize: 34, marginTop: 56, background: "#fff", color: "#d70f64", padding: "14px 28px", borderRadius: 999, alignSelf: "flex-start" }}>
          Order by Wednesday · Delivery Fri &amp; Sat
        </div>
      </div>
    ),
    size,
  );
}
