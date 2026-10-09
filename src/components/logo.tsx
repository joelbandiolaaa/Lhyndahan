import Image from "next/image";

const MARK_RATIO = 628 / 512;
const WORDMARK_RATIO = 720 / 246;

/** The Lhyndahan "L" cart mark, one colour: white on the red bars, black on light backgrounds. `size` is its height. */
export function LogoMark({ size = 36, tone = "white", className = "" }: { size?: number; tone?: "white" | "black"; className?: string }) {
  return (
    <Image
      src={tone === "white" ? "/mark-white.png" : "/mark-black.png"}
      alt=""
      aria-hidden
      width={Math.round(size * MARK_RATIO)}
      height={size}
      priority
      className={`shrink-0 ${className}`}
    />
  );
}

/** The hand-lettered "Lhyndahan" name. */
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
