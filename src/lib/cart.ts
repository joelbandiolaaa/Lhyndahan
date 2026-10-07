"use client";

import { useSyncExternalStore } from "react";

/**
 * Cart lives in localStorage (no login needed). Each line keeps a snapshot for
 * display; the server always re-prices from the database at checkout.
 */
export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imagePath: string | null;
  qty: number;
};

const KEY = "hopia-cart-v1";
export const MAX_QTY = 99;
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;
const EMPTY: CartLine[] = [];

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    cache = Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.productId === "string" && l.qty > 0) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Private mode / storage full: cart still works for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((n, l) => n + l.price * l.qty, 0);
}

export function addToCart(line: Omit<CartLine, "qty">, qty = 1) {
  const lines = read();
  const existing = lines.find((l) => l.productId === line.productId);
  if (existing) {
    write(lines.map((l) => (l.productId === line.productId ? { ...l, ...line, qty: Math.min(MAX_QTY, l.qty + qty) } : l)));
  } else {
    write([...lines, { ...line, qty: Math.min(MAX_QTY, qty) }]);
  }
}

export function setQty(productId: string, qty: number) {
  const lines = read();
  if (qty <= 0) write(lines.filter((l) => l.productId !== productId));
  else write(lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)));
}

/** Replace the cart with fresh server data (prices/names) and drop unavailable items. */
export function replaceCart(lines: CartLine[]) {
  write(lines);
}

export function clearCart() {
  write([]);
}
