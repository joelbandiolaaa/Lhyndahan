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
