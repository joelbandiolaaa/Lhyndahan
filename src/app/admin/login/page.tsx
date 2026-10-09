import { LogoMark, Wordmark } from "@/components/logo";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/admin/login">) {
  const { error, changed } = await props.searchParams;
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="bg-accent px-6 pt-16 pb-12 text-accent-ink">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-3 flex items-center gap-3">
            <LogoMark size={56} />
            <Wordmark height={52} />
          </div>
          <p className="text-[13px] font-semibold tracking-wide text-white/85 uppercase">Admin</p>
          <h1 className="mt-1 font-display text-[34px] leading-tight">Log in</h1>
          <p className="mt-1 text-white/85">For the store owner only.</p>
        </div>
      </div>
      <div className="mx-auto -mt-6 w-full max-w-sm px-4">
        <div className="rounded-[var(--radius-card)] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <LoginForm
            initialError={error === "not-admin" ? "This account doesn't have admin access." : undefined}
            notice={changed === "email" ? "Email changed. Log in with your new email." : undefined}
          />
        </div>
      </div>
    </main>
  );
}
