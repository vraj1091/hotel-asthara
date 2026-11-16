"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROOMS_TAG } from "@/features/rooms/queries";
import { ActionError } from "@/lib/action";
import {
  adminAction,
  bilingual,
  formObject,
  zCheckbox,
  zDayString,
  zInt,
  zOptionalRupees,
  zRupees,
  zSlug,
} from "@/lib/admin-action";
import { ROOM_AMENITY_KEYS } from "@/lib/amenities";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { recropImage } from "@/lib/media";
import { cleanText } from "@/lib/sanitize";
import { todayIST } from "@/lib/utils";

const zId = z.string().min(1).max(40);
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

function refresh(roomTypeId?: string, slug?: string) {
  revalidateTag(ROOMS_TAG);
  revalidatePath("/rooms");
  if (slug) revalidatePath(`/rooms/${slug}`);
  revalidatePath("/admin/rooms");
  if (roomTypeId) revalidatePath(`/admin/rooms/${roomTypeId}`);
}

/** Bookings that still hold a room (today or later), for safety checks before deleting. */
function futureBookingWhere(filter: { roomTypeId?: string; roomId?: string }) {
  return {
    ...filter,
    active: true,
    checkOut: { gt: todayIST() },
    booking: { deletedAt: null, status: { in: [...ACTIVE_STATUSES] } },
  };
}

function requireText(
  fd: FormData,
  name: string,
  label: string,
  max: number,
  errors: Record<string, string[]>,
) {
  const value = bilingual(fd, name, max);
  if (!value.en) errors[`${name}En`] = [`${label} in English is required.`];
  return value;
}

/* ───────── Room types ───────── */

const typeSchema = z.object({
  id: z.string().max(40).optional(),
  slug: zSlug,
  sizeSqFt: zInt(30, 20_000),
  bedType: z.string().trim().min(2, "Describe the bed, e.g. Double bed.").max(80),
  maxAdults: zInt(1, 12),
  maxChildren: zInt(0, 12),
  baseRate: zRupees(100, 1_000_000),
  extraBed: zOptionalRupees,
  featured: zCheckbox,
  active: zCheckbox,
});

export async function saveRoomType(_prev: unknown, fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const errors: Record<string, string[]> = {};
    const name = requireText(fd, "name", "Name", 100, errors);
    const summary = requireText(fd, "summary", "Summary", 300, errors);
    const description = requireText(fd, "description", "Description", 3000, errors);
    const parsed = typeSchema.safeParse(formObject(fd));
    if (!parsed.success)
      Object.assign(errors, parsed.error.flatten().fieldErrors as Record<string, string[]>);
    if (Object.keys(errors).length || !parsed.success)
      throw new ActionError("Check the highlighted fields and try again.", errors);
    const input = parsed.data;
    const id = input.id || undefined;

    // Slugs must be unique. A deleted room type releases its slug.
    const clash = await db.roomType.findFirst({
      where: { slug: input.slug, ...(id ? { NOT: { id } } : {}) },
    });
    if (clash && !clash.deletedAt)
      throw new ActionError("Another room type already uses this web address.", {
        slug: [`Used by “${clash.name}”. Choose a different slug.`],
      });
    if (clash?.deletedAt)
      await db.roomType.update({
        where: { id: clash.id },
        data: { slug: `${clash.slug}-deleted-${clash.id.slice(-5)}` },
      });

    const amenities = fd
      .getAll("amenities")
      .map(String)
      .filter((k) => ROOM_AMENITY_KEYS.includes(k));
    const data = {
      slug: input.slug,
      name: name.en,
      nameHi: name.hi || null,
      summary: summary.en,
      summaryHi: summary.hi || null,
      description: description.en,
      descriptionHi: description.hi || null,
      sizeSqFt: input.sizeSqFt,
      bedType: input.bedType,
      maxAdults: input.maxAdults,
      maxChildren: input.maxChildren,
      baseRatePaise: input.baseRate,
      extraBedPaise: input.extraBed,
      amenities,
      featured: input.featured,
      active: input.active,
    };

    if (id) {
      const before = await db.roomType.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new ActionError("That room type no longer exists.");
      await db.roomType.update({ where: { id }, data });
      await writeAudit({
        userId: staff.id,
        action: "room_type.update",
        entity: "RoomType",
        entityId: id,
        meta: {
          name: data.name,
          ...(before.baseRatePaise !== data.baseRatePaise
            ? { baseRate: { from: before.baseRatePaise, to: data.baseRatePaise } }
            : {}),
        },
      });
      refresh(id, data.slug);
      if (before.slug !== data.slug) revalidatePath(`/rooms/${before.slug}`);
      return { id };
    }

    const last = await db.roomType.aggregate({ _max: { sortOrder: true }, where: { deletedAt: null } });
    const created = await db.roomType.create({
      data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    await writeAudit({
      userId: staff.id,
      action: "room_type.create",
      entity: "RoomType",
      entityId: created.id,
      meta: { name: created.name },
    });
    refresh(created.id, created.slug);
    redirect(`/admin/rooms/${created.id}?tab=units&created=1`);
  }, "Room type saved.");
}

export async function moveRoomType(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const dir = z.enum(["up", "down"]).parse(fd.get("dir"));
    const all = await db.roomType.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { baseRatePaise: "asc" }],
      select: { id: true },
    });
    const i = all.findIndex((t) => t.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j]!, all[i]!];
    await db.$transaction(
      all.map((t, index) => db.roomType.update({ where: { id: t.id }, data: { sortOrder: index + 1 } })),
    );
    await writeAudit({ userId: staff.id, action: "room_type.reorder", entity: "RoomType", entityId: id, meta: { dir } });
    refresh();
  }, "Order saved.");
}

export async function toggleRoomType(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const field = z.enum(["active", "featured"]).parse(fd.get("field"));
    const value = fd.get("value") === "true";
    const t = await db.roomType.update({ where: { id }, data: { [field]: value } });
    await writeAudit({
      userId: staff.id,
      action: `room_type.${field}`,
      entity: "RoomType",
      entityId: id,
      meta: { [field]: value },
    });
    refresh(id, t.slug);
  }, "Updated.");
}

export async function deleteRoomType(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const type = await db.roomType.findFirst({ where: { id, deletedAt: null } });
    if (!type) throw new ActionError("That room type no longer exists.");
    const upcoming = await db.bookingRoom.count({ where: futureBookingWhere({ roomTypeId: id }) });
    if (upcoming)
      throw new ActionError(
        `${upcoming} upcoming or current booking${upcoming === 1 ? " uses" : "s use"} this room type. Move or cancel ${upcoming === 1 ? "it" : "them"} first, or switch the room type off instead of deleting it.`,
      );
    const now = new Date();
    await db.$transaction([
      db.room.updateMany({ where: { roomTypeId: id, deletedAt: null }, data: { deletedAt: now } }),
      db.roomType.update({
        where: { id },
        data: { deletedAt: now, active: false, slug: `${type.slug}-deleted-${id.slice(-5)}` },
      }),
    ]);
    await writeAudit({
      userId: staff.id,
      action: "room_type.delete",
      entity: "RoomType",
      entityId: id,
      meta: { name: type.name },
    });
    refresh(id, type.slug);
    if (fd.get("redirect") === "1") redirect("/admin/rooms");
  }, "Room type deleted.");
}

/* ───────── Units (physical rooms) ───────── */

const roomSchema = z.object({
  id: z.string().max(40).optional(),
  roomTypeId: zId,
  number: z
    .string()
    .trim()
    .min(1, "Enter the room number.")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
  floor: zInt(-5, 200),
  status: z.enum(["ACTIVE", "MAINTENANCE"]),
  notes: z
    .string()
    .optional()
    .transform((s) => (s ? cleanText(s, 300) : null)),
});

export async function saveRoom(_prev: unknown, fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const input = roomSchema.parse(formObject(fd));
    const id = input.id || undefined;
    const type = await db.roomType.findFirst({ where: { id: input.roomTypeId, deletedAt: null } });
    if (!type) throw new ActionError("That room type no longer exists.");
    const existing = await db.room.findUnique({
      where: { number: input.number },
      include: { roomType: { select: { name: true } } },
    });
    const data = {
      number: input.number,
      roomTypeId: input.roomTypeId,
      floor: input.floor,
      status: input.status,
      notes: input.notes,
    };

    if (existing && existing.id !== id && !existing.deletedAt)
      throw new ActionError("That room number is already in use.", {
        number: [`Room ${input.number} already exists (${existing.roomType.name}).`],
      });

    let roomId: string;
    if (id) {
      if (existing?.deletedAt && existing.id !== id)
        await db.room.update({
          where: { id: existing.id },
          data: { number: `${existing.number}~${existing.id.slice(-5)}` },
        });
      const r = await db.room.update({ where: { id }, data });
      roomId = r.id;
    } else if (existing?.deletedAt) {
      // Re-adding a number that was deleted earlier restores that room (keeping its booking history).
      const r = await db.room.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } });
      roomId = r.id;
    } else {
      const r = await db.room.create({ data });
      roomId = r.id;
    }
    await writeAudit({
      userId: staff.id,
      action: id ? "room.update" : "room.create",
      entity: "Room",
      entityId: roomId,
      meta: { number: input.number, status: input.status },
    });
    refresh(input.roomTypeId, type.slug);
    return { id: roomId };
  }, "Room saved.");
}

export async function deleteRoom(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const room = await db.room.findFirst({ where: { id, deletedAt: null }, include: { roomType: true } });
    if (!room) throw new ActionError("That room no longer exists.");
    const upcoming = await db.bookingRoom.count({ where: futureBookingWhere({ roomId: id }) });
    if (upcoming)
      throw new ActionError(
        `Room ${room.number} has ${upcoming} upcoming or current booking${upcoming === 1 ? "" : "s"}. Move ${upcoming === 1 ? "it" : "them"} to another room first, or set the room to Maintenance.`,
      );
    await db.room.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({
      userId: staff.id,
      action: "room.delete",
      entity: "Room",
      entityId: id,
      meta: { number: room.number },
    });
    refresh(room.roomTypeId, room.roomType.slug);
  }, "Room removed.");
}

/* ───────── Photos ───────── */

async function typeOrThrow(id: string) {
  const t = await db.roomType.findFirst({ where: { id, deletedAt: null }, select: { id: true, slug: true } });
  if (!t) throw new ActionError("That room type no longer exists.");
  return t;
}

export async function addRoomPhotos(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const roomTypeId = zId.parse(fd.get("roomTypeId"));
    const mediaIds = z.array(zId).min(1).max(50).parse(JSON.parse(String(fd.get("mediaIds") ?? "[]")));
    const type = await typeOrThrow(roomTypeId);
    const [assets, existing, last] = await Promise.all([
      db.mediaAsset.findMany({ where: { id: { in: mediaIds }, deletedAt: null } }),
      db.roomImage.findMany({ where: { roomTypeId, mediaId: { in: mediaIds } }, select: { mediaId: true } }),
      db.roomImage.aggregate({ where: { roomTypeId }, _max: { sortOrder: true } }),
    ]);
    const already = new Set(existing.map((e) => e.mediaId));
    const byId = new Map(assets.map((a) => [a.id, a]));
    let order = (last._max.sortOrder ?? -1) + 1;
    const toAdd = mediaIds.filter((m) => byId.has(m) && !already.has(m));
    if (toAdd.length === 0) throw new ActionError("Those photos are already on this room.");
    await db.roomImage.createMany({
      data: toAdd.map((m) => {
        const a = byId.get(m)!;
        return { roomTypeId, mediaId: a.id, url: a.url, alt: a.alt, sortOrder: order++ };
      }),
    });
    await writeAudit({
      userId: staff.id,
      action: "room_type.photos_add",
      entity: "RoomType",
      entityId: roomTypeId,
      meta: { count: toAdd.length },
    });
    refresh(roomTypeId, type.slug);
    return { added: toAdd.length };
  }).then((r) =>
    r.ok
      ? { ...r, message: `${r.data.added} photo${r.data.added === 1 ? "" : "s"} added.` }
      : r,
  );
}

export async function reorderRoomPhotos(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const roomTypeId = zId.parse(fd.get("roomTypeId"));
    const ids = z.array(zId).max(100).parse(JSON.parse(String(fd.get("ids") ?? "[]")));
    const type = await typeOrThrow(roomTypeId);
    const current = await db.roomImage.findMany({ where: { roomTypeId }, select: { id: true } });
    const known = new Set(current.map((c) => c.id));
    if (ids.length !== current.length || ids.some((i) => !known.has(i)))
      throw new ActionError("The photo list changed in the meantime. Refresh the page and try again.");
    await db.$transaction(
      ids.map((id, index) => db.roomImage.update({ where: { id }, data: { sortOrder: index } })),
    );
    await writeAudit({ userId: staff.id, action: "room_type.photos_reorder", entity: "RoomType", entityId: roomTypeId });
    refresh(roomTypeId, type.slug);
  }, "Photo order saved.");
}

export async function updateRoomPhotoAlt(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const alt = cleanText(String(fd.get("alt") ?? ""), 200);
    const img = await db.roomImage.update({
      where: { id },
      data: { alt },
      include: { roomType: { select: { slug: true } } },
    });
    await writeAudit({ userId: staff.id, action: "room_type.photo_alt", entity: "RoomImage", entityId: id });
    refresh(img.roomTypeId, img.roomType.slug);
  }, "Alt text saved.");
}

export async function removeRoomPhoto(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const img = await db.roomImage.findUnique({ where: { id }, include: { roomType: { select: { slug: true } } } });
    if (!img) throw new ActionError("That photo was already removed.");
    await db.roomImage.delete({ where: { id } });
    await writeAudit({
      userId: staff.id,
      action: "room_type.photo_remove",
      entity: "RoomType",
      entityId: img.roomTypeId,
      meta: { mediaId: img.mediaId },
    });
    refresh(img.roomTypeId, img.roomType.slug);
  }, "Photo removed from this room. It is still in the media library.");
}

const zCrop = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

/** Re-crop a photo used on this room (changes the library image everywhere it is used). */
export async function cropRoomPhoto(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const crop = zCrop.parse(JSON.parse(String(fd.get("crop") ?? "{}")));
    const img = await db.roomImage.findUnique({ where: { id }, include: { roomType: { select: { slug: true } } } });
    if (!img?.mediaId) throw new ActionError("This photo is not in the media library, so it cannot be cropped here.");
    await recropImage(img.mediaId, crop);
    await writeAudit({ userId: staff.id, action: "media.crop", entity: "MediaAsset", entityId: img.mediaId });
    refresh(img.roomTypeId, img.roomType.slug);
    revalidatePath("/admin/media");
  }, "Photo cropped.");
}

/* ───────── Rate rules ───────── */

const ruleBase = z.object({
  id: z.string().max(40).optional(),
  roomTypeId: zId,
  scope: z.enum(["type", "all"]),
  name: z.string().trim().min(2, "Give the rule a name, e.g. Weekend or Diwali.").max(80),
  kind: z.enum(["WEEKEND", "SEASONAL", "FESTIVAL"]),
  adjustment: z.enum(["PERCENT", "FIXED_RATE"]),
  value: z.string().trim().min(1, "Enter the adjustment."),
  priority: zInt(-100, 100),
  active: zCheckbox,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function savePriceRule(_prev: unknown, fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const input = ruleBase.parse(formObject(fd));
    const id = input.id || undefined;
    const errors: Record<string, string[]> = {};
    const type = await typeOrThrow(input.roomTypeId);

    let value = 0;
    if (input.adjustment === "PERCENT") {
      const pct = Number(input.value.replace(/[%\s+]/g, ""));
      if (!Number.isInteger(pct) || pct < -90 || pct > 500 || pct === 0)
        errors.value = ["Enter a whole percentage between −90 and +500 (not 0), e.g. 20 or −10."];
      value = pct;
    } else {
      const parsed = zRupees(100, 1_000_000).safeParse(input.value);
      if (!parsed.success) errors.value = ["Enter the nightly rate in rupees, at least ₹100."];
      else value = parsed.data;
    }

    let days: number[] = [];
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (input.kind === "WEEKEND") {
      days = [...new Set(fd.getAll("days").map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (days.length === 0) errors.days = ["Tick at least one day of the week."];
    } else {
      const s = zDayString.safeParse(input.startDate ?? "");
      const e = zDayString.safeParse(input.endDate ?? "");
      if (!s.success) errors.startDate = ["Choose the first date."];
      if (!e.success) errors.endDate = ["Choose the last date."];
      if (s.success && e.success) {
        if (e.data < s.data) errors.endDate = ["The last date must be on or after the first date."];
        startDate = s.data;
        endDate = e.data;
      }
    }
    if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);

    const data = {
      roomTypeId: input.scope === "all" ? null : input.roomTypeId,
      name: input.name,
      kind: input.kind,
      adjustment: input.adjustment,
      value,
      priority: input.priority,
      active: input.active,
      daysOfWeek: days,
      startDate,
      endDate,
    };
    const rule = id
      ? await db.priceRule.update({ where: { id }, data })
      : await db.priceRule.create({ data });
    await writeAudit({
      userId: staff.id,
      action: id ? "price_rule.update" : "price_rule.create",
      entity: "PriceRule",
      entityId: rule.id,
      meta: { name: rule.name, kind: rule.kind, adjustment: rule.adjustment, value: rule.value, scope: input.scope },
    });
    refresh(input.roomTypeId, type.slug);
    if (input.scope === "all") revalidatePath("/admin/rooms", "layout");
    return { id: rule.id };
  }, "Rate rule saved.");
}

export async function togglePriceRule(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const active = fd.get("active") === "true";
    await db.priceRule.update({ where: { id }, data: { active } });
    await writeAudit({ userId: staff.id, action: "price_rule.toggle", entity: "PriceRule", entityId: id, meta: { active } });
    revalidateTag(ROOMS_TAG);
    revalidatePath("/admin/rooms", "layout");
  }, "Rule updated.");
}

export async function deletePriceRule(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const rule = await db.priceRule.delete({ where: { id } });
    await writeAudit({
      userId: staff.id,
      action: "price_rule.delete",
      entity: "PriceRule",
      entityId: id,
      meta: { name: rule.name },
    });
    revalidateTag(ROOMS_TAG);
    revalidatePath("/admin/rooms", "layout");
  }, "Rate rule deleted.");
}

/* ───────── Blocked dates ───────── */

const blockSchema = z.object({
  id: z.string().max(40).optional(),
  roomTypeId: zId,
  target: z.string().min(1).max(40), // "type" or a room id
  startDate: z.string(),
  endDate: z.string(),
  reason: z
    .string()
    .optional()
    .transform((s) => (s ? cleanText(s, 200) : null)),
});

export async function saveBlock(_prev: unknown, fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const input = blockSchema.parse(formObject(fd));
    const id = input.id || undefined;
    const type = await typeOrThrow(input.roomTypeId);
    const errors: Record<string, string[]> = {};
    const s = zDayString.safeParse(input.startDate);
    const e = zDayString.safeParse(input.endDate);
    if (!s.success) errors.startDate = ["Choose the first blocked night."];
    if (!e.success) errors.endDate = ["Choose the date the block ends."];
    if (s.success && e.success && e.data <= s.data)
      errors.endDate = ["The end date must be after the start date (the end date itself is not blocked)."];
    let roomId: string | null = null;
    if (input.target !== "type") {
      const room = await db.room.findFirst({
        where: { id: input.target, roomTypeId: input.roomTypeId, deletedAt: null },
      });
      if (!room) errors.target = ["Choose a room of this type."];
      else roomId = room.id;
    }
    if (Object.keys(errors).length || !s.success || !e.success)
      throw new ActionError("Check the highlighted fields and try again.", errors);

    const data = {
      roomId,
      roomTypeId: roomId ? null : input.roomTypeId,
      startDate: s.data,
      endDate: e.data,
      reason: input.reason,
    };
    const block = id
      ? await db.roomBlock.update({ where: { id }, data })
      : await db.roomBlock.create({ data });
    await writeAudit({
      userId: staff.id,
      action: id ? "room_block.update" : "room_block.create",
      entity: "RoomBlock",
      entityId: block.id,
      meta: { roomTypeId: input.roomTypeId, roomId, startDate: input.startDate, endDate: input.endDate },
    });
    refresh(input.roomTypeId, type.slug);
    return { id: block.id };
  }, "Dates blocked.");
}

export async function deleteBlock(fd: FormData) {
  return adminAction("rooms:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const block = await db.roomBlock.delete({ where: { id } });
    await writeAudit({ userId: staff.id, action: "room_block.delete", entity: "RoomBlock", entityId: id });
    revalidateTag(ROOMS_TAG);
    revalidatePath("/rooms");
    revalidatePath("/admin/rooms", "layout");
    return { roomTypeId: block.roomTypeId };
  }, "Block removed. Those dates are bookable again.");
}
