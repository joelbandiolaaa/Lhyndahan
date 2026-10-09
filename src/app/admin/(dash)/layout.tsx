import { LogoMark, Wordmark } from "@/components/logo";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";
import { logout } from "../login/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { supabase, email } = await requireAdmin();
  const { count: newOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("seen_by_admin", false);

  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-60">
      <AdminNav newOrders={newOrders ?? 0} />
      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between bg-accent px-4 text-accent-ink md:px-8">
        <span className="flex items-center gap-2.5 md:hidden">
          <LogoMark size={32} />
          <Wordmark height={26} />
          <span className="text-[13px] font-semibold tracking-wide uppercase text-white/85">Admin</span>
        </span>
        <span className="hidden text-sm text-white/85 md:block">{email}</span>
        <form action={logout}>
          <button className="tap min-h-11 rounded-full px-3 text-[15px] text-accent-ink">Log out</button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
