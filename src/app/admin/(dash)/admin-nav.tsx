"use client";

import { LogoMark } from "@/components/logo";
import { ClipboardList, LayoutGrid, MapPinned, Package, Settings, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// New sections get added here as each milestone ships.
const items = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, exact: false },
  { href: "/admin/batch", label: "Batch", icon: Truck, exact: false },
  { href: "/admin/deliveries", label: "Delivery", icon: MapPinned, exact: false },
  { href: "/admin/products", label: "Products", icon: Package, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="num absolute -top-1 left-1/2 ml-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function AdminNav({ newOrders = 0 }: { newOrders?: number }) {
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* Phone: bottom tab bar */}
      <nav
        aria-label="Admin"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-surface/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`tap flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                    active ? "font-semibold text-link" : "text-muted"
                  }`}
                >
                  <span className="relative">
                    <Icon size={22} strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                    {href === "/admin/orders" ? <Badge n={newOrders} /> : null}
                  </span>
                  {label}
                  {href === "/admin/orders" && newOrders > 0 ? <span className="sr-only">, {newOrders} new</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: sidebar */}
      <nav aria-label="Admin" className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-black/[0.08] bg-surface/75 px-4 py-6 backdrop-blur-xl md:block">
        <p className="flex items-center gap-2.5 px-3 font-display text-xl">
          <LogoMark size={34} tone="black" />
          <span>Lhyndahan <span className="text-link">Admin</span></span>
        </p>
        <ul className="mt-8 flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`tap flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${
                    active ? "bg-accent-soft font-semibold text-link" : "text-muted hover:bg-black/[0.04] hover:text-ink"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {href === "/admin/orders" && newOrders > 0 ? (
                    <span className="num rounded-full bg-danger px-2 text-[12px] font-semibold text-white">{newOrders}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
