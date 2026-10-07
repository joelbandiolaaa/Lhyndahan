import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "icon";

const base =
  "tap inline-flex items-center justify-center gap-2 rounded-full font-medium select-none cursor-pointer " +
  "disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100";

// Apple: one filled blue action per screen; everything else is quiet.
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "bg-accent-soft text-link hover:brightness-[0.97]",
  ghost: "text-link hover:bg-accent-soft",
  danger: "bg-black/[0.05] text-danger hover:bg-black/[0.08]",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-5 text-[17px]",
  lg: "min-h-[3.25rem] px-6 text-[17px] w-full",
  icon: "size-12 shrink-0",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({ variant, size, loading, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
