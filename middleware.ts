import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

// Edge middleware.
// - Admin: a fast "is anyone signed in" gate. Permissions are checked against the database by every admin page,
//   server action and API route (lib/session.ts), so a role change or deactivation applies immediately rather
//   than when the 12-hour token expires.
// - Public pages: `?lang=hi` / `?lang=en` switches language (used by hreflang links and shareable Hindi URLs).
const { auth } = NextAuth(authConfig);

const adminGate = auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const isApi = pathname.startsWith("/api/admin");

  // The login page itself sends signed-in staff on to the admin, after checking the account is still active.
  // Redirecting here on the token alone would loop for a deactivated account (admin → login → admin …).
  if (pathname === "/admin/login" || pathname.startsWith("/admin/invite/")) return NextResponse.next();
  if (!user) {
    if (isApi) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

function languageParam(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? undefined;
  if (!isLocale(lang) || req.cookies.get(LOCALE_COOKIE)?.value === lang) return NextResponse.next();
  // Make this very request render in the chosen language, and remember it for the next one.
  req.cookies.set(LOCALE_COOKIE, lang);
  const headers = new Headers(req.headers);
  headers.set("cookie", req.cookies.toString());
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(LOCALE_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return (adminGate as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response>)(
      req,
      ev,
    );
  }
  return languageParam(req);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    // Public pages only: skip static files, images, media and the other API routes.
    "/((?!_next/|api/|media/|images/|favicon|icon|apple-icon|opengraph-image|manifest|robots|sitemap).*)",
  ],
};
