import Image from "next/image";

/** The Lhyndahan "L" mark, one colour: white on the pink bars, black on light backgrounds. */
export function LogoMark({ size = 36, tone = "white", className = "" }: { size?: number; tone?: "white" | "black"; className?: string }) {
  return (
    <Image
      src={tone === "white" ? "/logo-white.png" : "/logo-black.png"}
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className={`shrink-0 ${className}`}
    />
  );
}

const WORDMARK_RATIO = 720 / 246;

/** The hand-lettered "Lhyndahan" name. Pass the visible text alongside it elsewhere (this is decorative). */
export function Wordmark({ height = 30, tone = "white", className = "" }: { height?: number; tone?: "white" | "black"; className?: string }) {
  return (
    <Image
      src={tone === "white" ? "/wordmark-white.png" : "/wordmark-black.png"}
      alt="Lhyndahan"
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
      priority
      className={`shrink-0 ${className}`}
    />
  );
}
