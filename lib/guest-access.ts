import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Guests see a booking's details (name, phone, payment) only after proving they own it: either they just made it
 * in this browser, or they entered the reference with the phone number or email on "Manage booking".
 * The proof is an HMAC-signed, httpOnly cookie listing the references this browser may open, valid for 7 days.
 */
const COOKIE = "asthara_bookings";
const MAX_REFS = 8;
const TTL_MS = 7 * 24 * 3_600_000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}
const sign = (payload: string) => createHmac("sha256", secret()).update(`guest-access:${payload}`).digest("base64url");

type Payload = { refs: string[]; exp: number };

async function read(): Promise<Payload> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return { refs: [], exp: 0 };
  const [data, sig] = raw.split(".");
  if (!data || !sig) return { refs: [], exp: 0 };
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { refs: [], exp: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Payload;
    if (!Array.isArray(parsed.refs) || parsed.exp < Date.now()) return { refs: [], exp: 0 };
    return parsed;
  } catch {
    return { refs: [], exp: 0 };
  }
}

/** Server actions / route handlers only (cookies can be written there). */
export async function grantBookingAccess(reference: string) {
  const current = await read();
  const refs = [reference, ...current.refs.filter((r) => r !== reference)].slice(0, MAX_REFS);
  const data = Buffer.from(JSON.stringify({ refs, exp: Date.now() + TTL_MS } satisfies Payload)).toString("base64url");
  (await cookies()).set(COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function hasBookingAccess(reference: string) {
  return (await read()).refs.includes(reference);
}

/** Compare what the guest typed with the booking's contact details. */
export function contactMatches(input: string, guest: { phone: string; email: string | null }) {
  const value = input.trim().toLowerCase();
  if (!value) return false;
  if (value.includes("@")) return !!guest.email && guest.email.toLowerCase() === value;
  const digits = value.replace(/\D/g, "").slice(-10);
  return digits.length === 10 && guest.phone.replace(/\D/g, "").slice(-10) === digits;
}
