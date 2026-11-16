import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { hashToken } from "@/features/staff/tokens";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, settings] = await Promise.all([params, getSettings()]);
  const valid = /^[A-Za-z0-9_-]{20,100}$/.test(token);
  const user = valid
    ? await db.user.findFirst({
        where: { inviteToken: hashToken(token), inviteExpiry: { gt: new Date() }, deletedAt: null, active: true },
        include: { role: true },
      })
    : null;

  return (
    <main className="theme-dark grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-md">
        <Logo name={settings.hotel.name} />
        <div className="card mt-8 p-8">
          {user ? (
            <>
              <h1 className="text-h3">{user.passwordHash ? "Choose a new password" : `Welcome, ${user.name.split(" ")[0]}`}</h1>
              <p className="text-muted mt-1 mb-6">
                {user.passwordHash
                  ? `Set a new password for ${user.email}.`
                  : `You have a ${user.role.name} account for ${user.email}. Choose a password to finish setting it up.`}
              </p>
              <SetPasswordForm token={token} email={user.email} />
            </>
          ) : (
            <>
              <h1 className="text-h3">This link has expired</h1>
              <p className="text-muted mt-2">
                Invite and password links work once and for a limited time. Ask your manager to send you a new link
                from Admin → Staff.
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link href="/admin/login">Go to sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
