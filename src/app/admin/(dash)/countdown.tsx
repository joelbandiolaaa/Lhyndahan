"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
}

/** Time left until the batch closes; ticks every 30 s. */
export function Countdown({ cutoffAt }: { cutoffAt: string }) {
  const target = new Date(cutoffAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client clock only (avoids hydration mismatch)
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return <span className="num">—</span>;
  if (now >= target) return <span>Closed</span>;
  const { d, h, m } = parts(target - now);
  return (
    <span className="num">
      {d > 0 ? `${d}d ` : ""}
      {h}h {m}m
    </span>
  );
}
