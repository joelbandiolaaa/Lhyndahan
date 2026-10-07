/** "gcash" only exists on orders placed before QR Code payments; new orders are "cod" or "qr". */
export type PaymentMethod = "cod" | "qr" | "gcash";

export function paymentLabel(method: PaymentMethod, qrProvider?: string | null) {
  if (method === "cod") return "Cash on Delivery";
  if (method === "gcash") return "GCash";
  return qrProvider ? `QR · ${qrProvider}` : "QR Code";
}

export function paymentShortLabel(method: PaymentMethod, qrProvider?: string | null) {
  if (method === "cod") return "COD";
  if (method === "gcash") return "GCash";
  return qrProvider ? `QR · ${qrProvider}` : "QR";
}
