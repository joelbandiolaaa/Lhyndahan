"use server";

import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import type { PaymentMethod } from "@/lib/payment";
import { supabasePublic } from "@/lib/shop";

export type OrderView = {
  code: string;
  name: string;
  status: "pending" | "ordered" | "delivered" | "cancelled";
  paid: boolean;
  payment_method: PaymentMethod;
  qr_id: string | null;
  qr_provider: string | null;
  delivery_type: "office" | "outside";
  delivery_date: string;
  total: number;
  created_at: string;
  items: { name: string; qty: number; price: number }[];
};

export type LookupState = { order?: OrderView; message?: string; values?: { code: string; phone: string } };

export async function findOrder(code: string, phoneInput: string): Promise<LookupState> {
  const c = z.string().trim().regex(/^lh-?\d{1,6}$/i).safeParse(code);
  const phone = normalizePhone(phoneInput);
  if (!c.success) return { message: "Enter your order number, e.g. LH-0012." };
  if (!phone) return { message: "Enter the mobile number you used for the order." };

  const digits = c.data.replace(/\D/g, "");
  const normalized = `LH-${digits.length < 4 ? digits.padStart(4, "0") : digits}`;
  const { data, error } = await supabasePublic().rpc("lookup_order", { p_code: normalized, p_phone: phone });
  if (error?.message.includes("rate_limited")) return { message: "Too many tries. Please wait a little while, or message us." };
  if (error) return { message: "Something went wrong. Please try again." };
  if (!data) return { message: "We couldn't find that order. Please check your order number and mobile number." };
  return { order: data as OrderView };
}

export async function lookupAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const code = String(formData.get("code") ?? "");
  const phone = String(formData.get("phone") ?? "");
  // Echo the typed values back: React clears uncontrolled fields after a form action.
  return { ...(await findOrder(code, phone)), values: { code, phone } };
}
