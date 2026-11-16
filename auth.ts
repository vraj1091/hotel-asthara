import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import authConfig from "@/auth.config";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = clientIp(request.headers);
        const [byEmail, byIp] = await Promise.all([
          rateLimit("login-email", email, LIMITS.login),
          rateLimit("login-ip", ip, { limit: 20, windowMs: LIMITS.login.windowMs }),
        ]);
        if (!byEmail.ok || !byIp.ok) return null;

        const user = await db.user.findFirst({
          where: { email, active: true, deletedAt: null },
          include: { role: true },
        });
        const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.passwordHash || !valid) {
          await writeAudit({ action: "auth.login_failed", entity: "User", meta: { email } });
          return null;
        }

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await writeAudit({
          userId: user.id,
          action: "auth.login",
          entity: "User",
          entityId: user.id,
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleKey: user.role.key,
          permissions: user.role.permissions,
        };
      },
    }),
  ],
});
