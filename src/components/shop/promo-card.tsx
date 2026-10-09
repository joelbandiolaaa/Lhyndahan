import Image from "next/image";
import Link from "next/link";
import { PROMO_BGS, type PromoSlide } from "@/lib/promos";

/** One banner. Used by the shop carousel and by the admin preview, so what the owner sees is what customers get. */
export function PromoCard({ slide, priority = false, sizes = "(min-width: 768px) 480px, 88vw" }: { slide: PromoSlide; priority?: boolean; sizes?: string }) {
  const bg = PROMO_BGS[slide.bg];
  const hasImage = !!slide.imageUrl;
  const hasText = !!(slide.badge || slide.headline || slide.subtext);

  const body = (
    <div className={`relative flex aspect-[2/1] min-h-[150px] w-full overflow-hidden rounded-[var(--radius-card)] ${hasImage ? "bg-sunken text-white" : bg.card}`}>
      {hasImage ? (
        <>
          <Image src={slide.imageUrl!} alt={slide.headline ?? "Promo"} fill sizes={sizes} priority={priority} className="object-cover" />
          {hasText ? <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" aria-hidden /> : null}
        </>
      ) : (
        <span aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-44 rounded-full bg-white/10" />
      )}
      {hasText ? (
        <div className="relative mt-auto flex flex-col items-start gap-1.5 p-4">
          {slide.badge ? <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold tracking-wide ${hasImage ? "bg-white/25 text-white" : bg.chip}`}>{slide.badge}</span> : null}
          {slide.headline ? <p className="font-display text-[22px] leading-tight">{slide.headline}</p> : null}
          {slide.subtext ? <p className="line-clamp-2 text-[14px] leading-snug opacity-95">{slide.subtext}</p> : null}
        </div>
      ) : null}
    </div>
  );

  return slide.href ? (
    <Link href={slide.href} className="block rounded-[var(--radius-card)] focus-visible:outline-offset-2">
      {body}
    </Link>
  ) : (
    body
  );
}
