import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/layout/logo";
import { getStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; notice?: string }>;
}) {
  const [{ callbackUrl, notice }, settings, session, staff] = await Promise.all([searchParams, getSettings(), auth(), getStaff()]);
  const next =
    callbackUrl?.startsWith("/admin") && !callbackUrl.startsWith("/admin/login") && !callbackUrl.includes("\\") ? callbackUrl : "/admin";
  // Already signed in with an active account: straight on. A token for a deactivated or removed account stays here.
  if (staff) redirect(next);
  const inactive = !!session?.user?.id;
  const message =
    notice === "password-set"
      ? "Your password is set. Sign in with your email and new password."
      : notice === "password-changed"
        ? "Your password was changed. Sign in again."
        : null;
  return (
    <main className="theme-dark grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-md">
        <Logo name={settings.hotel.name} />
        <div className="card mt-8 p-8">
          <h1 className="text-h3">Staff sign in</h1>
          <p className="text-muted mt-1 mb-6">Use the account your manager created for you.</p>
          {message ? (
            <p role="status" className="border-success/40 bg-success/15 text-ink mb-6 rounded-xl border px-4 py-3 text-sm">
              {message}
            </p>
          ) : null}
          {inactive ? (
            <p role="alert" className="border-warning/40 bg-warning/10 text-ink mb-6 rounded-xl border px-4 py-3 text-sm">
              This account is no longer active. Ask a manager to reactivate it, or sign in with another account.
            </p>
          ) : null}
          <LoginForm callbackUrl={next} />
        </div>
      </div>
    </main>
  );
}
