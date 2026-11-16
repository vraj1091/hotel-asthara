import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { emailLayout, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

/** Invite and password-reset links. Only the SHA-256 hash of the token is stored, so a database leak reveals no link. */

export const INVITE_DAYS = 7;
export const RESET_HOURS = 24;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const inviteUrl = (token: string) => absoluteUrl(`/admin/invite/${token}`);

/**
 * Gives the user a fresh link (invalidating any previous one) and emails it when email is configured.
 * Returns the link so the admin can copy it when email is not set up.
 */
export async function issueLink(userId: string, kind: "invite" | "reset", invitedBy: string) {
  const { token, hash } = newToken();
  const expiry = new Date(Date.now() + (kind === "invite" ? INVITE_DAYS * 86_400_000 : RESET_HOURS * 3_600_000));
  const user = await db.user.update({
    where: { id: userId },
    data: { inviteToken: hash, inviteExpiry: expiry },
    include: { role: true },
  });
  const link = inviteUrl(token);
  const settings = await getSettings();
  const isInvite = kind === "invite";
  const { html, text } = emailLayout({
    hotelName: settings.hotel.name,
    title: isInvite ? `You are invited to the ${settings.hotel.name} admin` : "Reset your admin password",
    intro: `Hello ${user.name.split(" ")[0]},`,
    paragraphs: isInvite
      ? [
          `${invitedBy} has given you a ${user.role.name} account for the ${settings.hotel.name} admin panel.`,
          `Use the button below to choose your password. The link works for ${INVITE_DAYS} days and only once.`,
        ]
      : [
          `${invitedBy} sent you a link to choose a new password for the ${settings.hotel.name} admin panel.`,
          `The link works for ${RESET_HOURS} hours and only once. Your current password keeps working until you set a new one.`,
        ],
    button: { label: isInvite ? "Set your password" : "Choose a new password", url: link },
    footer: "If you were not expecting this email, you can ignore it.",
  });
  const sent = await sendEmail({
    kind: "staff.invite",
    to: user.email,
    subject: isInvite ? `Your ${settings.hotel.name} admin account` : `Reset your ${settings.hotel.name} admin password`,
    html,
    text,
  });
  return { link, emailed: sent.ok, expiresAt: expiry.toISOString() };
}
