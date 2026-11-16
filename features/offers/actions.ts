"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OFFERS_TAG } from "@/features/cms/queries";
import { ActionError } from "@/lib/action";
import { adminAction, bilingual, zCheckbox, zImageUrl, zInt } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isDayString, parseDay, slugify } from "@/lib/utils";

const zId = z.string().min(1).max(40);
const IST = 330 * 60_000;
const DAY = 86_400_000;

/** "YYYY-MM-DD" → 00:00 IST that day, or 23:59:59.999 IST for an end date. */
function istInstant(v: FormDataEntryValue | null, end: boolean): Date | null {
  const s = String(v ?? "");
  if (!s) return null;
  if (!isDayString(s)) throw new ActionError("Check the dates.", { [end ? "endsAt" : "startsAt"]: ["Choose a valid date."] });
  return new Date(parseDay(s).getTime() - IST + (end ? DAY - 1 : 0));
}

function dateRange(fd: FormData) {
  const startsAt = istInstant(fd.get("startsAt"), false);
  const endsAt = istInstant(fd.get("endsAt"), true);
  if (startsAt && endsAt && endsAt < startsAt)
    throw new ActionError("The end date is before the start date.", { endsAt: ["Must be on or after the start date."] });
  return { startsAt, endsAt };
}

function refreshPublic() {
  revalidateTag(OFFERS_TAG);
  revalidatePath("/offers");
  revalidatePath("/");
  revalidatePath("/admin/offers");
  revalidatePath("/admin/offers/codes");
}

/* ───────── Offers ───────── */

async function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base).slice(0, 60) || "offer";
  for (let i = 1; i < 100; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const hit = await db.offer.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function saveOffer(_prev: unknown, fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = fd.get("id") ? zId.parse(fd.get("id")) : null;
    const title = bilingual(fd, "title", 120);
    const description = bilingual(fd, "description", 1000);
    const errors: Record<string, string[]> = {};
    if (title.en.length < 3) errors.titleEn = ["Give the offer a title (at least 3 characters)."];
    if (description.en.length < 10) errors.descriptionEn = ["Describe the offer in a sentence or two."];
    const image = zImageUrl.safeParse(String(fd.get("imageUrl") ?? ""));
    if (!image.success) errors.imageUrl = [image.error.issues[0]!.message];
    if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);
    const couponId = String(fd.get("couponId") ?? "") || null;
    if (couponId) {
      const c = await db.coupon.findFirst({ where: { id: couponId, deletedAt: null } });
      if (!c) throw new ActionError("That promo code no longer exists.", { couponId: ["Choose another code."] });
    }
    const { startsAt, endsAt } = dateRange(fd);
    const active = zCheckbox.parse(fd.get("active") ?? undefined);
    const data = {
      title: title.en,
      titleHi: title.hi || null,
      description: description.en,
      descriptionHi: description.hi || null,
      imageUrl: image.success && image.data ? image.data : null,
      couponId,
      startsAt,
      endsAt,
      active,
    };
    let offerId: string;
    if (id) {
      const existing = await db.offer.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new ActionError("That offer no longer exists.");
      await db.offer.update({ where: { id }, data: { ...data, slug: await uniqueSlug(title.en, id) } });
      offerId = id;
    } else {
      const last = await db.offer.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } });
      const created = await db.offer.create({
        data: { ...data, slug: await uniqueSlug(title.en), sortOrder: (last._max.sortOrder ?? 0) + 1 },
      });
      offerId = created.id;
    }
    await writeAudit({ userId: staff.id, action: id ? "offer.update" : "offer.create", entity: "Offer", entityId: offerId, meta: { title: title.en } });
    refreshPublic();
    if (!id) redirect("/admin/offers");
  }, "Offer saved.");
}

export async function setOfferActive(fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const active = fd.get("active") === "1";
    await db.offer.update({ where: { id }, data: { active } });
    await writeAudit({ userId: staff.id, action: active ? "offer.activate" : "offer.deactivate", entity: "Offer", entityId: id });
    refreshPublic();
  }, "Offer updated.");
}

export async function moveOffer(fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const dir = z.enum(["up", "down"]).parse(fd.get("dir"));
    const list = await db.offer.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
    const i = list.findIndex((o) => o.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    await db.$transaction(list.map((o, idx) => db.offer.update({ where: { id: o.id }, data: { sortOrder: idx + 1 } })));
    await writeAudit({ userId: staff.id, action: "offer.reorder", entity: "Offer", entityId: id, meta: { dir } });
    refreshPublic();
  }, "Order updated.");
}

export async function deleteOffer(fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    await db.offer.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await writeAudit({ userId: staff.id, action: "offer.delete", entity: "Offer", entityId: id });
    refreshPublic();
    if (fd.get("redirect") === "1") redirect("/admin/offers");
  }, "Offer deleted.");
}

/* ───────── Promo codes ───────── */

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,30}$/, "Use 3 to 30 capital letters, numbers or hyphens."),
    kind: z.enum(["PERCENT", "FLAT"]),
    value: z.string().transform((s) => s.replace(/[,₹\s%]/g, "")).pipe(z.coerce.number({ invalid_type_error: "Enter a number." }).positive("Must be more than 0.")),
    maxDiscount: z.string().optional().transform((s) => (s ?? "").replace(/[,₹\s]/g, "")),
    minNights: zInt(1, 30),
    minAmount: z.string().optional().transform((s) => (s ?? "").replace(/[,₹\s]/g, "")),
    usageLimit: z.string().optional().transform((s) => (s ?? "").trim()),
  });

export async function saveCoupon(_prev: unknown, fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = fd.get("id") ? zId.parse(fd.get("id")) : null;
    const input = couponSchema.parse(Object.fromEntries(fd));
    const errors: Record<string, string[]> = {};
    let value: number;
    if (input.kind === "PERCENT") {
      if (!Number.isInteger(input.value) || input.value < 1 || input.value > 100) errors.value = ["Enter a whole percentage from 1 to 100."];
      value = Math.round(input.value);
    } else {
      if (input.value > 1_000_000) errors.value = ["That discount is too large."];
      value = Math.round(input.value * 100);
    }
    const num = (s: string, field: string, min: number) => {
      if (!s) return null;
      const n = Number(s);
      if (!Number.isFinite(n) || n < min) {
        errors[field] = [`Enter a number of at least ${min}, or leave it empty.`];
        return null;
      }
      return n;
    };
    const maxRupees = input.kind === "PERCENT" ? num(input.maxDiscount, "maxDiscount", 1) : null;
    const minAmountRupees = num(input.minAmount, "minAmount", 0);
    const usageLimit = num(input.usageLimit, "usageLimit", 1);
    if (usageLimit !== null && !Number.isInteger(usageLimit)) errors.usageLimit = ["Enter a whole number."];
    const clash = await db.coupon.findUnique({ where: { code: input.code }, select: { id: true, deletedAt: true } });
    if (clash && clash.id !== id)
      errors.code = [clash.deletedAt ? "This code was used before and deleted. Choose a different code." : "That code already exists."];
    if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);
    const { startsAt, endsAt } = dateRange(fd);
    const data = {
      code: input.code,
      kind: input.kind,
      value,
      maxDiscountPaise: maxRupees !== null ? Math.round(maxRupees * 100) : null,
      minNights: input.minNights,
      minAmountPaise: Math.round((minAmountRupees ?? 0) * 100),
      usageLimit: usageLimit !== null ? Math.round(usageLimit) : null,
      startsAt,
      endsAt,
      active: zCheckbox.parse(fd.get("active") ?? undefined),
    };
    let couponId: string;
    if (id) {
      const existing = await db.coupon.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new ActionError("That promo code no longer exists.");
      await db.coupon.update({ where: { id }, data });
      couponId = id;
    } else {
      couponId = (await db.coupon.create({ data })).id;
    }
    await writeAudit({ userId: staff.id, action: id ? "coupon.update" : "coupon.create", entity: "Coupon", entityId: couponId, meta: { code: input.code } });
    refreshPublic();
    if (!id) redirect("/admin/offers/codes");
  }, "Promo code saved.");
}

export async function setCouponActive(fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const active = fd.get("active") === "1";
    await db.coupon.update({ where: { id }, data: { active } });
    await writeAudit({ userId: staff.id, action: active ? "coupon.activate" : "coupon.deactivate", entity: "Coupon", entityId: id });
    refreshPublic();
  }, "Promo code updated.");
}

export async function resetCouponCount(fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    await db.coupon.update({ where: { id }, data: { usedCount: 0 } });
    await writeAudit({ userId: staff.id, action: "coupon.reset_count", entity: "Coupon", entityId: id });
    refreshPublic();
  }, "Usage count reset to 0.");
}

export async function deleteCoupon(fd: FormData) {
  return adminAction("offers:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const linked = await db.offer.findMany({ where: { couponId: id, deletedAt: null }, select: { title: true } });
    if (linked.length)
      throw new ActionError(
        `This code is used by the offer “${linked.map((o) => o.title).join("”, “")}”. Remove it from the offer first.`,
      );
    const coupon = await db.coupon.findUniqueOrThrow({ where: { id }, select: { code: true } });
    // Free the code for reuse; past bookings keep their own copy of the code they used.
    await db.coupon.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, code: `${coupon.code}~DEL-${id.slice(-6)}` },
    });
    await writeAudit({ userId: staff.id, action: "coupon.delete", entity: "Coupon", entityId: id, meta: { code: coupon.code } });
    refreshPublic();
    if (fd.get("redirect") === "1") redirect("/admin/offers/codes");
  }, "Promo code deleted.");
}
