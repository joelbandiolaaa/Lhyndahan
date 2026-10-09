"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PromoSlide } from "@/lib/promos";
import { PromoCard } from "./promo-card";

const GAP = 12;
const EVERY_MS = 5000;

/**
 * Food-app style promo strip: swipe sideways (cards snap, the next one peeks in),
 * slides itself every few seconds, and stops the moment someone touches, hovers or
 * focuses it. Nothing moves for people who asked their phone to reduce motion.
 */
export function PromoCarousel({ slides }: { slides: PromoSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const paused = useRef(false);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = slides.length;

  const step = useCallback(() => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + GAP : 0;
  }, []);

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      el.scrollTo({ left: i * step(), behavior: "smooth" });
    },
    [step],
  );

  const onScroll = () => {
    const el = track.current;
    const s = step();
    if (!el || !s) return;
    const i = Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / s)));
    activeRef.current = i;
    setActive(i);
  };

  useEffect(() => {
    if (n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (paused.current || document.hidden) return;
      go((activeRef.current + 1) % n);
    }, EVERY_MS);
    return () => clearInterval(t);
  }, [n, go]);

  const hold = () => {
    paused.current = true;
    if (resume.current) clearTimeout(resume.current);
  };
  const release = (delay = 0) => {
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => (paused.current = false), delay);
  };

  if (n === 0) return null;
  return (
    <section aria-roledescription="carousel" aria-label="Promotions" className="pt-4">
      <div
        ref={track}
        onScroll={onScroll}
        onMouseEnter={hold}
        onMouseLeave={() => release()}
        onFocus={hold}
        onBlur={() => release()}
        onTouchStart={hold}
        onTouchEnd={() => release(6000)}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            className={`shrink-0 snap-start ${n === 1 ? "w-full" : "w-[88%] md:w-[calc(50%-6px)]"}`}
          >
            <PromoCard slide={s} priority={i === 0} />
          </div>
        ))}
      </div>
      {n > 1 ? (
        <div className="mt-1 flex justify-center">
          {slides.map((s, i) => (
            <button key={s.id} type="button" aria-label={`Show promo ${i + 1}`} aria-current={i === active} onClick={() => { hold(); go(i); release(6000); }} className="grid size-6 place-items-center">
              <span className={`block h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-accent" : "w-1.5 bg-black/20"}`} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
