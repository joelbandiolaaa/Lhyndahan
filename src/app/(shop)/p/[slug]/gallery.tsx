"use client";

import { useRef, useState } from "react";
import { ProductImg } from "@/components/product-image";

/** Swipeable photo gallery (native scroll-snap, no library) with dots. */
export function Gallery({ name, paths }: { name: string; paths: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const el = track.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(i: number) {
    track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={track}
        onScroll={onScroll}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-[var(--radius-card)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={`${name} photos`}
        role="region"
      >
        {paths.map((path, i) => (
          <ProductImg
            key={path}
            path={path}
            alt={`${name}, photo ${i + 1} of ${paths.length}`}
            priority={i === 0}
            sizes="(min-width: 768px) 560px, 100vw"
            className="aspect-square w-full shrink-0 snap-center"
          />
        ))}
      </div>
      {paths.length > 1 ? (
        <div className="flex justify-center gap-1">
          {paths.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={() => go(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className="flex size-6 items-center justify-center"
            >
              <span className={`size-2 rounded-full transition-colors ${i === index ? "bg-ink" : "bg-black/20"}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
