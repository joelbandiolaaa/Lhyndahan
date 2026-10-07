import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius-card)] bg-surface ${className}`}>{children}</section>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-display text-[22px]">{title}</p>
      {body ? <p className="max-w-xs text-muted">{body}</p> : null}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "bg-accent-soft text-ink",
    error: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-[15px] ${tones[tone]}`}>
      {children}
    </div>
  );
}
