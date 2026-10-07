"use client";

import { useEffect } from "react";
import { markSeen } from "./actions";

/** Clears the "new order" badge a few seconds after the orders were shown. */
export function MarkSeen({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => void markSeen(key.split(",")), 4000);
    return () => clearTimeout(t);
  }, [key]);
  return null;
}
