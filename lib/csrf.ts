import { NextResponse } from "next/server";

/**
 * CSRF defence for route handlers (Server Actions already compare Origin to Host in Next.js, and
 * Auth.js protects its own endpoints). State-changing requests must come from our own origin.
 * Returns a 403 response if the check fails, otherwise null.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients (webhooks use their own signature check) send no Origin.
    return request.headers.get("sec-fetch-site") === "cross-site"
      ? NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 })
      : null;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let allowed = false;
  try {
    allowed = new URL(origin).host === host;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!allowed && site) allowed = new URL(origin).host === new URL(site).host;
  } catch {
    allowed = false;
  }
  return allowed
    ? null
    : NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
}
