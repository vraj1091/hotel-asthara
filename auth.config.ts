import type { NextAuthConfig } from "next-auth";

/** Edge-safe half of the Auth.js config (no database, no bcrypt). Used by middleware.ts. */
export default {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // staff sign in again every 12 hours
  pages: { signIn: "/admin/login" },
  providers: [],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roleKey = user.roleKey;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.roleKey = token.roleKey ?? "";
      session.user.permissions = token.permissions ?? [];
      return session;
    },
  },
} satisfies NextAuthConfig;
