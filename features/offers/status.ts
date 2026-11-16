/** Pure helpers shared by the offers pages (no server-only imports). */

export type OfferStatus = "live" | "scheduled" | "ended" | "inactive";
export type CouponStatus = "active" | "scheduled" | "expired" | "used-up" | "inactive";

export function offerStatus(o: { active: boolean; startsAt: Date | null; endsAt: Date | null }, now = new Date()): OfferStatus {
  if (!o.active) return "inactive";
  if (o.startsAt && o.startsAt > now) return "scheduled";
  if (o.endsAt && o.endsAt < now) return "ended";
  return "live";
}

export function couponStatus(
  c: { active: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number },
  now = new Date(),
): CouponStatus {
  if (!c.active) return "inactive";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  if (c.endsAt && c.endsAt < now) return "expired";
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "used-up";
  return "active";
}

export const OFFER_STATUS_UI: Record<OfferStatus, { label: string; tone: "success" | "gold" | "neutral" | "warning" }> = {
  live: { label: "Live", tone: "success" },
  scheduled: { label: "Scheduled", tone: "gold" },
  ended: { label: "Ended", tone: "neutral" },
  inactive: { label: "Inactive", tone: "warning" },
};

export const COUPON_STATUS_UI: Record<CouponStatus, { label: string; tone: "success" | "gold" | "neutral" | "warning" | "danger" }> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "gold" },
  expired: { label: "Expired", tone: "neutral" },
  "used-up": { label: "Used up", tone: "danger" },
  inactive: { label: "Inactive", tone: "warning" },
};

/** IST calendar day ("YYYY-MM-DD") of a stored timestamp, for date inputs. */
export const istDay = (d: Date | null | undefined) =>
  d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10) : "";

export function couponLabel(c: { kind: "PERCENT" | "FLAT"; value: number; maxDiscountPaise: number | null }) {
  if (c.kind === "PERCENT")
    return `${c.value}% off${c.maxDiscountPaise ? ` (up to ₹${(c.maxDiscountPaise / 100).toLocaleString("en-IN")})` : ""}`;
  return `₹${(c.value / 100).toLocaleString("en-IN")} off`;
}
