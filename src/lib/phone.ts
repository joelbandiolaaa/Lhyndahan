/**
 * Accepts the ways people type PH mobile numbers (0917 123 4567, +63 917…,
 * 63917…, 917…) and returns +639XXXXXXXXX, or null if it isn't one.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local: string | null = null;
  if (/^09\d{9}$/.test(digits)) local = digits.slice(1);
  else if (/^639\d{9}$/.test(digits)) local = digits.slice(2);
  else if (/^9\d{9}$/.test(digits)) local = digits;
  return local ? `+63${local}` : null;
}

/** +639171234567 → 0917 123 4567 */
export function formatPhone(e164: string): string {
  const m = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}
