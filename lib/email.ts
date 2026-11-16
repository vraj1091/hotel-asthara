import "server-only";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";

/**
 * Transactional email through Resend's HTTP API (no SDK). Set RESEND_API_KEY and EMAIL_FROM.
 * Without a key nothing is sent, but every attempt is recorded in EmailLog with status SKIPPED so the front desk
 * can see what would have gone out (Admin → Settings → Email log). Sending never throws: a mail problem must not
 * break a booking.
 */

export type EmailKind =
  | "booking.guest"
  | "booking.hotel"
  | "booking.cancelled"
  | "enquiry.reply"
  | "enquiry.hotel"
  | "staff.invite";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(args: {
  kind: EmailKind;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  bookingId?: string | null;
}) {
  const to = (Array.isArray(args.to) ? args.to : [args.to]).map((t) => t.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false as const, status: "SKIPPED" as const };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Hotel Asthara <onboarding@resend.dev>";
  let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
  let error: string | null = key ? null : "RESEND_API_KEY is not set";

  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject: args.subject,
          html: args.html,
          text: args.text,
          ...(args.replyTo ? { reply_to: args.replyTo } : {}),
        }),
      });
      if (res.ok) status = "SENT";
      else {
        status = "FAILED";
        error = `${res.status} ${(await res.text()).slice(0, 300)}`;
      }
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[email:skipped] ${args.kind} → ${to.join(", ")}: ${args.subject}`);
  }

  await db.emailLog
    .create({
      data: {
        kind: args.kind,
        to: to.join(", "),
        subject: args.subject.slice(0, 300),
        status,
        error,
        bookingId: args.bookingId ?? null,
      },
    })
    .catch((e) => console.error("[email] could not write log", e));
  if (status === "FAILED") console.error(`[email] ${args.kind} failed: ${error}`);
  return { ok: status === "SENT", status };
}

/* ───────── Templates: simple, table-free HTML that renders well in Gmail and Outlook ───────── */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function emailLayout(args: {
  hotelName: string;
  title: string;
  intro?: string;
  rows?: [string, string][];
  paragraphs?: string[];
  button?: { label: string; url: string };
  footer?: string;
}) {
  const rows = (args.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#5b6470;font-size:14px;width:42%">${esc(k)}</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${esc(v)}</td></tr>`,
    )
    .join("");
  const paragraphs = (args.paragraphs ?? [])
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:${BRAND.ivory};font-family:Arial,Helvetica,sans-serif;color:${BRAND.navy}">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:${BRAND.navy};color:${BRAND.ivory};padding:20px 24px;border-radius:16px 16px 0 0">
    <div style="font-family:Georgia,serif;font-size:22px">${esc(args.hotelName)}</div>
  </div>
  <div style="background:#ffffff;padding:24px;border-radius:0 0 16px 16px;border:1px solid #e6e0d4;border-top:3px solid ${BRAND.gold}">
    <h1 style="font-family:Georgia,serif;font-weight:500;font-size:22px;margin:0 0 12px">${esc(args.title)}</h1>
    ${args.intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${esc(args.intro)}</p>` : ""}
    ${rows ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 18px">${rows}</table>` : ""}
    ${paragraphs}
    ${args.button ? `<p style="margin:20px 0 4px"><a href="${esc(args.button.url)}" style="display:inline-block;background:${BRAND.gold};color:${BRAND.navy};text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(args.button.label)}</a></p>` : ""}
  </div>
  ${args.footer ? `<p style="font-size:12px;color:#5b6470;margin:16px 4px;line-height:1.5">${esc(args.footer)}</p>` : ""}
</div></body></html>`;
  const text = [
    args.hotelName,
    "",
    args.title,
    args.intro ?? "",
    ...(args.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    "",
    ...(args.paragraphs ?? []),
    args.button ? `${args.button.label}: ${args.button.url}` : "",
    args.footer ?? "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return { html, text };
}
