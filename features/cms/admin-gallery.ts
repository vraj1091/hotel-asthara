"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { GALLERY_TAG } from "@/features/cms/queries";
import { ActionError } from "@/lib/action";
import { adminAction, zSlug } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { updateSetting } from "@/lib/settings-write";
import { fieldError, loadSetting, moveItem, parseL, str } from "./admin-shared";

const zId = z.string().min(1).max(40);
const zDir = z.enum(["up", "down"]);

function refresh() {
  revalidateTag(GALLERY_TAG);
  revalidatePath("/gallery");
  revalidatePath("/");
}

async function categoryKeys() {
  return (await loadSetting("gallery")).categories.map((c) => c.key);
}

/** Adds library images to the gallery (skips ones already in it). */
export async function addGalleryImages(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const ids = z.array(zId).min(1).max(50).parse(JSON.parse(String(fd.get("mediaIds") ?? "[]")));
    const category = str(fd, "category");
    if (!(await categoryKeys()).includes(category)) throw new ActionError("Choose a category first.");
    const media = await db.mediaAsset.findMany({ where: { id: { in: ids }, deletedAt: null } });
    const existing = new Set(
      (await db.galleryImage.findMany({ where: { mediaId: { in: ids }, deletedAt: null }, select: { mediaId: true } })).map((g) => g.mediaId),
    );
    const last = await db.galleryImage.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } });
    let order = (last._max.sortOrder ?? 0) + 1;
    const fresh = ids.map((id) => media.find((m) => m.id === id)).filter((m) => m && !existing.has(m.id));
    for (const m of fresh)
      await db.galleryImage.create({
        data: { mediaId: m!.id, url: m!.url, alt: m!.alt, altHi: m!.altHi, category, sortOrder: order++ },
      });
    await writeAudit({ userId: staff.id, action: "gallery.add", entity: "GalleryImage", meta: { count: fresh.length, category } });
    refresh();
    const skipped = ids.length - fresh.length;
    return {
      message: fresh.length
        ? `${fresh.length} photo${fresh.length === 1 ? "" : "s"} added to the gallery${skipped ? ` (${skipped} already there)` : ""}.`
        : "Those photos are already in the gallery.",
    };
  }).then((r) => (r.ok ? { ...r, message: r.data.message } : r));
}

export async function updateGalleryImage(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const category = str(fd, "category");
    if (!(await categoryKeys()).includes(category)) fieldError("category", "Choose a category.");
    const alt = parseL(fd, "alt", { max: 200, label: "Description" });
    await db.galleryImage.update({
      where: { id },
      data: { category, alt: alt.en, altHi: alt.hi, visible: fd.get("visible") === "on" },
    });
    await writeAudit({ userId: staff.id, action: "gallery.update", entity: "GalleryImage", entityId: id });
    refresh();
  }, "Photo saved.");
}

export async function toggleGalleryVisible(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const visible = fd.get("visible") === "1";
    await db.galleryImage.update({ where: { id }, data: { visible } });
    await writeAudit({ userId: staff.id, action: "gallery.visibility", entity: "GalleryImage", entityId: id, meta: { visible } });
    refresh();
  }, "Visibility updated.");
}

export async function moveGalleryImage(fd: FormData) {
  return adminAction("content:write", async () => {
    const id = zId.parse(fd.get("id"));
    const rows = await db.galleryImage.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    const next = moveItem(rows, id, zDir.parse(fd.get("dir")));
    await db.$transaction(next.map((r, i) => db.galleryImage.update({ where: { id: r.id }, data: { sortOrder: i + 1 } })));
    refresh();
  }, "Order updated.");
}

export async function removeGalleryImage(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    await db.galleryImage.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ userId: staff.id, action: "gallery.remove", entity: "GalleryImage", entityId: id });
    refresh();
  }, "Removed from the gallery. The photo stays in the media library.");
}

/* ───────── Categories ───────── */

export async function saveGalleryCategory(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const original = str(fd, "originalKey");
    const keyParse = zSlug.safeParse(str(fd, "key"));
    if (!keyParse.success) fieldError("key", keyParse.error.issues[0]!.message);
    const key = keyParse.data;
    const label = parseL(fd, "label", { max: 40, label: "Name" });
    const { categories } = await loadSetting("gallery");
    if (key !== original && categories.some((c) => c.key === key)) fieldError("key", "Another category already uses this key.");
    let next;
    if (original) {
      if (!categories.some((c) => c.key === original)) throw new ActionError("That category no longer exists. Refresh the page.");
      next = categories.map((c) => (c.key === original ? { key, label } : c));
      if (key !== original) await db.galleryImage.updateMany({ where: { category: original }, data: { category: key } });
    } else {
      if (categories.length >= 12) throw new ActionError("Use up to 12 categories.");
      next = [...categories, { key, label }];
    }
    await updateSetting("gallery", { categories: next });
    await writeAudit({ userId: staff.id, action: original ? "gallery.category_update" : "gallery.category_add", entity: "Setting", entityId: "gallery", meta: { key } });
    refresh();
  }, "Category saved.");
}

export async function deleteGalleryCategory(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const key = str(fd, "key");
    const used = await db.galleryImage.count({ where: { category: key, deletedAt: null } });
    if (used) throw new ActionError(`${used} photo${used === 1 ? " uses" : "s use"} this category. Move ${used === 1 ? "it" : "them"} to another category first.`);
    const { categories } = await loadSetting("gallery");
    if (categories.length <= 1) throw new ActionError("Keep at least one category.");
    await updateSetting("gallery", { categories: categories.filter((c) => c.key !== key) });
    await writeAudit({ userId: staff.id, action: "gallery.category_delete", entity: "Setting", entityId: "gallery", meta: { key } });
    refresh();
  }, "Category removed.");
}

export async function moveGalleryCategory(fd: FormData) {
  return adminAction("content:write", async () => {
    const { categories } = await loadSetting("gallery");
    const withId = categories.map((c) => ({ ...c, id: c.key }));
    const next = moveItem(withId, str(fd, "key"), zDir.parse(fd.get("dir"))).map(({ key, label }) => ({ key, label }));
    await updateSetting("gallery", { categories: next });
    refresh();
  }, "Order updated.");
}
