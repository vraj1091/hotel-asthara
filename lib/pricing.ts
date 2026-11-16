import { dayKey, eachNight } from "@/lib/utils";
import type { GstSettings } from "@/types/content";

export type PriceRuleInput = {
  id: string;
  name: string;
  kind: "WEEKEND" | "SEASONAL" | "FESTIVAL";
  adjustment: "PERCENT" | "FIXED_RATE";
  value: number;
  startDate: Date | null;
  endDate: Date | null;
  daysOfWeek: number[];
  priority: number;
  roomTypeId: string | null;
};

export type NightlyRate = {
  date: string;
  ratePaise: number;
  taxPaise: number;
  rule: string | null;
};

export type StayQuote = {
  nights: NightlyRate[];
  nightCount: number;
  subtotalPaise: number; // before tax, per room
  taxPaise: number;
  totalPaise: number;
  averageRatePaise: number;
};

const KIND_WEIGHT = { FESTIVAL: 3, SEASONAL: 2, WEEKEND: 1 } as const;

/** The rule that applies on one night: highest priority, then festival > seasonal > weekend. */
export function ruleForNight(
  date: Date,
  roomTypeId: string,
  rules: PriceRuleInput[],
): PriceRuleInput | null {
  const dow = date.getUTCDay();
  const key = dayKey(date);
  const matches = rules.filter((r) => {
    if (r.roomTypeId && r.roomTypeId !== roomTypeId) return false;
    if (r.kind === "WEEKEND") return r.daysOfWeek.includes(dow);
    if (!r.startDate || !r.endDate) return false;
    return dayKey(r.startDate) <= key && key <= dayKey(r.endDate);
  });
  matches.sort((a, b) => b.priority - a.priority || KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind]);
  return matches[0] ?? null;
}

export function nightlyRate(baseRatePaise: number, rule: PriceRuleInput | null): number {
  if (!rule) return baseRatePaise;
  if (rule.adjustment === "FIXED_RATE") return Math.max(0, rule.value);
  // Percentage rules land on a whole rupee so guests never see ₹2,068.85 a night.
  return Math.max(0, Math.round((baseRatePaise * (100 + rule.value)) / 10_000) * 100);
}

export function gstPercentFor(
  ratePaise: number,
  gst: Pick<GstSettings, "lowPercent" | "highPercent" | "thresholdPaise">,
) {
  return ratePaise <= gst.thresholdPaise ? gst.lowPercent : gst.highPercent;
}

/** Price one room for a stay. GST slab is decided per night from that night's tariff. */
export function quoteStay(args: {
  roomTypeId: string;
  baseRatePaise: number;
  rules: PriceRuleInput[];
  checkIn: Date;
  checkOut: Date;
  gst: Pick<GstSettings, "lowPercent" | "highPercent" | "thresholdPaise">;
}): StayQuote {
  const nights = eachNight(args.checkIn, args.checkOut).map((date) => {
    const rule = ruleForNight(date, args.roomTypeId, args.rules);
    const ratePaise = nightlyRate(args.baseRatePaise, rule);
    const taxPaise = Math.round((ratePaise * gstPercentFor(ratePaise, args.gst)) / 100);
    return { date: dayKey(date), ratePaise, taxPaise, rule: rule?.name ?? null };
  });
  const subtotalPaise = nights.reduce((s, n) => s + n.ratePaise, 0);
  const taxPaise = nights.reduce((s, n) => s + n.taxPaise, 0);
  return {
    nights,
    nightCount: nights.length,
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise + taxPaise,
    averageRatePaise: nights.length
      ? Math.round(subtotalPaise / nights.length)
      : args.baseRatePaise,
  };
}

/** Apply a discount to the pre-tax amount; GST is recalculated on what is left. */
export function applyDiscount(subtotalPaise: number, taxPaise: number, discountPaise: number) {
  const discount = Math.min(Math.max(0, discountPaise), subtotalPaise);
  const remaining = subtotalPaise - discount;
  const tax = subtotalPaise === 0 ? 0 : Math.round((taxPaise * remaining) / subtotalPaise);
  return { subtotalPaise, discountPaise: discount, taxPaise: tax, totalPaise: remaining + tax };
}

export function couponDiscount(
  coupon: { kind: "PERCENT" | "FLAT"; value: number; maxDiscountPaise: number | null },
  subtotalPaise: number,
) {
  const raw =
    coupon.kind === "PERCENT" ? Math.round((subtotalPaise * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscountPaise ? Math.min(raw, coupon.maxDiscountPaise) : raw;
  return Math.min(capped, subtotalPaise);
}
