"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Food-app style category tabs: stick under the header, tap to jump, and
 * the pink underline follows the section you are looking at.
 */
export function CategoryNav({ categories }: { categories: { id: string; label: string }[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const bar = useRef<HTMLDivElement>(null);
  const jumping = useRef(false);

  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumping.current) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    const tab = bar.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    tab?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    jumping.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => (jumping.current = false), 700);
  }

  if (categories.length < 2) return null;

  return (
    <nav aria-label="Categories" className="sticky top-[calc(4.5rem+env(safe-area-inset-top))] z-20 -mx-4 border-b border-line bg-surface">
      <div ref={bar} className="flex overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => {
          const on = c.id === active;
          return (
            <a
              key={c.id}
              href={`#${c.id}`}
              data-id={c.id}
              aria-current={on ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                jump(c.id);
              }}
              className={`relative flex min-h-12 shrink-0 items-center px-3.5 text-[15px] whitespace-nowrap transition-colors ${
                on ? "font-semibold text-link" : "text-muted"
              }`}
            >
              {c.label}
              <span
                aria-hidden
                className={`absolute inset-x-3.5 bottom-0 h-[3px] rounded-t-full bg-accent transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
              />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
