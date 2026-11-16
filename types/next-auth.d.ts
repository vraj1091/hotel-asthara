import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    roleKey?: string;
    permissions?: string[];
  }
  interface Session {
    user: {
      id: string;
      roleKey: string;
      permissions: string[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    roleKey?: string;
    permissions?: string[];
  }
}
