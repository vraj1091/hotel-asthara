"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string } | null;

/** Only allow redirects back into the admin area, never to another site. */
function safeRedirect(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/admin") && !path.startsWith("//") && !path.includes("\\")
    ? path
    : "/admin";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const limit = await rateLimit("login-form", clientIp(await headers()), {
    limit: 25,
    windowMs: LIMITS.login.windowMs,
  });
  if (!limit.ok) return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError)
      return { error: "Email or password is incorrect, or the account is inactive." };
    throw error; // the redirect after a successful sign-in is thrown by Next.js and must propagate
  }
  return null;
}
