"use server";

import { z } from "zod";
import { ActionError } from "@/lib/action";
import { adminAction, zImageUrl } from "@/lib/admin-action";
import { AMENITY_BY_KEY } from "@/lib/amenities";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DEFAULT_SECTIONS, FIXED_SECTION } from "@/lib/defaults";
import { updateSection, updateSetting } from "@/lib/settings-write";
import type { NearbyPlace, SectionContent, SectionKey } from "@/types/content";
import { ICON_NAMES, SEO_PAGE_KEYS } from "./admin-constants";
import { fieldError, loadSection, loadSetting, moveItem, newId, parseL, str } from "./admin-shared";

const SECTION_KEYS = DEFAULT_SECTIONS.map((s) => s.key) as [SectionKey, ...SectionKey[]];
const zSectionKey = z.enum(SECTION_KEYS);
const zDir = z.enum(["up", "down"]);
const zIcon = z.enum(ICON_NAMES, { errorMap: () => ({ message: "Choose an icon." }) });

function parseLimit(fd: FormData, min: number, max: number) {
  const r = z.coerce.number().int().min(min).max(max).safeParse(fd.get("limit"));
  if (!r.success) fieldError("limit", `Enter a whole number from ${min} to ${max}.`);
  return r.data;
}

/* ───────── Homepage sections ───────── */

async function orderedKeys(): Promise<SectionKey[]> {
  const rows = await db.pageSection.findMany({ select: { key: true, sortOrder: true } });
  const order = new Map(rows.map((r) => [r.key, r.sortOrder]));
  return DEFAULT_SECTIONS.map((s, i) => ({ key: s.key, order: order.get(s.key) ?? 1000 + i }))
    .filter((s) => s.key !== FIXED_SECTION)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.key);
}

export async function toggleSection(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const key = zSectionKey.parse(fd.get("key"));
    if (key === FIXED_SECTION) throw new ActionError("The hero is always shown.");
    const enabled = fd.get("enabled") === "1";
    await updateSection(key, { enabled });
    await writeAudit({ userId: staff.id, action: "website.section_toggle", entity: "PageSection", entityId: key, meta: { enabled } });
    return { message: enabled ? "Section shown on the homepage." : "Section hidden from the homepage." };
  }).then((r) => (r.ok ? { ...r, message: r.data.message } : r));
}

export async function moveSection(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const key = zSectionKey.parse(fd.get("key"));
    const dir = zDir.parse(fd.get("dir"));
    const keys = await orderedKeys();
    const i = keys.indexOf(key);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    await updateSection(FIXED_SECTION, { sortOrder: 0 });
    for (const [n, k] of keys.entries()) await updateSection(k, { sortOrder: n + 1 });
    await writeAudit({ userId: staff.id, action: "website.section_move", entity: "PageSection", entityId: key, meta: { dir } });
  }, "Order updated.");
}

/** Title + intro (or CTA title + body) and, where the section has one, the item limit. */
export async function saveSectionContent(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const key = zSectionKey.parse(fd.get("key"));
    if (key === "HERO") throw new ActionError("Edit the hero on the Hero tab.");
    const title = parseL(fd, "title", { max: 160, label: "Title" });
    let content: Record<string, unknown>;
    if (key === "CTA") content = { title, body: parseL(fd, "body", { max: 400, label: "Text" }) };
    else content = { title, intro: parseL(fd, "intro", { max: 600, required: false }) };
    if (key === "ROOMS_GRID") content.limit = parseLimit(fd, 1, 12);
    if (key === "GALLERY") content.limit = parseLimit(fd, 1, 6);
    if (key === "FAQ") content.limit = parseLimit(fd, 1, 20);
    await updateSection(key, { content: content as Partial<SectionContent[SectionKey]> });
    await writeAudit({ userId: staff.id, action: "website.section_save", entity: "PageSection", entityId: key });
  }, "Section saved.");
}

/* Why choose us: points */

export async function saveWhyPoint(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = str(fd, "id");
    const icon = zIcon.safeParse(fd.get("icon"));
    if (!icon.success) fieldError("icon", "Choose an icon.");
    const point = { id: id || newId(), icon: icon.data, title: parseL(fd, "title", { max: 120, label: "Title" }), body: parseL(fd, "body", { max: 400, label: "Text" }) };
    const content = await loadSection("WHY_CHOOSE_US");
    const points = id ? content.points.map((p) => (p.id === id ? point : p)) : [...content.points, point];
    if (id && !content.points.some((p) => p.id === id)) throw new ActionError("That point no longer exists. Refresh the page.");
    if (points.length > 8) throw new ActionError("Keep it to 8 points or fewer.");
    await updateSection("WHY_CHOOSE_US", { content: { points } });
    await writeAudit({ userId: staff.id, action: id ? "website.point_update" : "website.point_add", entity: "PageSection", entityId: "WHY_CHOOSE_US" });
  }, "Point saved.");
}

export async function deleteWhyPoint(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = str(fd, "id");
    const content = await loadSection("WHY_CHOOSE_US");
    await updateSection("WHY_CHOOSE_US", { content: { points: content.points.filter((p) => p.id !== id) } });
    await writeAudit({ userId: staff.id, action: "website.point_delete", entity: "PageSection", entityId: "WHY_CHOOSE_US" });
  }, "Point removed.");
}

export async function moveWhyPoint(fd: FormData) {
  return adminAction("content:write", async () => {
    const content = await loadSection("WHY_CHOOSE_US");
    await updateSection("WHY_CHOOSE_US", { content: { points: moveItem(content.points, str(fd, "id"), zDir.parse(fd.get("dir"))) } });
  }, "Order updated.");
}

/* Instagram feed posts */

const zHttps = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\/[^\s]+$/.test(v), "Use a full link starting with https://");

export async function saveInstagramPost(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = str(fd, "id");
    const imageUrl = zImageUrl.parse(str(fd, "imageUrl"));
    if (!imageUrl) fieldError("imageUrl", "Choose an image.");
    const link = zHttps.safeParse(str(fd, "link"));
    if (!link.success) fieldError("link", link.error.issues[0]!.message);
    const alt = str(fd, "alt").slice(0, 200);
    if (alt.length < 3) fieldError("alt", "Describe the photo in a few words.");
    const post = { id: id || newId(), imageUrl, link: link.data, alt };
    const content = await loadSection("INSTAGRAM_FEED");
    const posts = id ? content.posts.map((p) => (p.id === id ? post : p)) : [...content.posts, post];
    if (posts.length > 12) throw new ActionError("Show up to 12 posts.");
    await updateSection("INSTAGRAM_FEED", { content: { posts } });
    await writeAudit({ userId: staff.id, action: id ? "website.instagram_update" : "website.instagram_add", entity: "PageSection", entityId: "INSTAGRAM_FEED" });
  }, "Post saved.");
}

export async function deleteInstagramPost(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const content = await loadSection("INSTAGRAM_FEED");
    await updateSection("INSTAGRAM_FEED", { content: { posts: content.posts.filter((p) => p.id !== str(fd, "id")) } });
    await writeAudit({ userId: staff.id, action: "website.instagram_delete", entity: "PageSection", entityId: "INSTAGRAM_FEED" });
  }, "Post removed.");
}

export async function moveInstagramPost(fd: FormData) {
  return adminAction("content:write", async () => {
    const content = await loadSection("INSTAGRAM_FEED");
    await updateSection("INSTAGRAM_FEED", { content: { posts: moveItem(content.posts, str(fd, "id"), zDir.parse(fd.get("dir"))) } });
  }, "Order updated.");
}

/* ───────── Hero ───────── */

export async function saveHero(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const headline = parseL(fd, "headline", { max: 120, label: "Headline" });
    const subhead = parseL(fd, "subhead", { max: 400, label: "Text under the headline" });
    const imageUrl = zImageUrl.parse(str(fd, "imageUrl"));
    const posterUrl = zImageUrl.parse(str(fd, "posterUrl"));
    const videoUrl = str(fd, "videoUrl");
    if (videoUrl && !/^https:\/\/[^\s]+\.(mp4|webm)(\?[^\s]*)?$/i.test(videoUrl))
      fieldError("videoUrl", "Use an https link that ends in .mp4 or .webm, or leave it empty.");
    await updateSection("HERO", { content: { headline, subhead, imageUrl, videoUrl, posterUrl } });
    await writeAudit({ userId: staff.id, action: "website.hero_save", entity: "PageSection", entityId: "HERO" });
  }, "Hero saved.");
}

/* ───────── About ───────── */

export async function saveAbout(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const about = {
      title: parseL(fd, "title", { max: 120, label: "Title" }),
      intro: parseL(fd, "intro", { max: 300, required: false }),
      body: parseL(fd, "body", { max: 8000, long: true, label: "Text" }),
      imageUrl: zImageUrl.parse(str(fd, "imageUrl")),
    };
    await updateSetting("about", about);
    await writeAudit({ userId: staff.id, action: "website.about_save", entity: "Setting", entityId: "about" });
  }, "About page saved.");
}

/* ───────── Amenities ───────── */

export async function saveAmenities(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const enabled = fd.getAll("amenity").map(String).filter((k) => k in AMENITY_BY_KEY);
    if (enabled.length === 0) throw new ActionError("Switch on at least one amenity.");
    const title = parseL(fd, "title", { max: 160, label: "Title" });
    const intro = parseL(fd, "intro", { max: 600, required: false });
    await updateSetting("amenities", { enabled });
    await updateSection("AMENITIES", { content: { title, intro } });
    await writeAudit({ userId: staff.id, action: "website.amenities_save", entity: "Setting", entityId: "amenities", meta: { enabled } });
  }, "Amenities saved.");
}

/* ───────── Location & nearby ───────── */

const zNum = (min: number, max: number, label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number.` })
    .min(min, `${label} must be between ${min} and ${max}.`)
    .max(max, `${label} must be between ${min} and ${max}.`)
    .refine((n) => Number.isFinite(n), `${label} must be a number.`);

export async function saveLocation(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const errors: Record<string, string[]> = {};
    const text = (k: string, label: string, min = 1, max = 200) => {
      const v = str(fd, k).replace(/\s+/g, " ");
      if (v.length < min) errors[k] = [`${label} is required.`];
      else if (v.length > max) errors[k] = [`Keep it under ${max} characters.`];
      return v;
    };
    const addressLine = text("addressLine", "Address", 5, 300);
    const locality = text("locality", "Locality");
    const city = text("city", "City");
    const state = text("state", "State");
    const postalCode = str(fd, "postalCode");
    if (!/^\d{6}$/.test(postalCode)) errors.postalCode = ["Enter the 6-digit PIN code."];
    const lat = zNum(-90, 90, "Latitude").safeParse(str(fd, "latitude") || "x");
    if (!lat.success) errors.latitude = [lat.error.issues[0]!.message];
    const lng = zNum(-180, 180, "Longitude").safeParse(str(fd, "longitude") || "x");
    if (!lng.success) errors.longitude = [lng.error.issues[0]!.message];
    const mapsPlaceUrl = str(fd, "mapsPlaceUrl");
    if (mapsPlaceUrl && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s]*$/i.test(mapsPlaceUrl))
      errors.mapsPlaceUrl = ["Paste a Google Maps link (https://maps.app.goo.gl/… or https://www.google.com/maps/…), or leave it empty."];
    if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);
    await updateSetting("hotel", {
      addressLine,
      locality,
      city,
      state,
      postalCode,
      latitude: Math.round(lat.data! * 1e6) / 1e6,
      longitude: Math.round(lng.data! * 1e6) / 1e6,
      mapsPlaceUrl,
    });
    await writeAudit({ userId: staff.id, action: "website.location_save", entity: "Setting", entityId: "hotel" });
  }, "Location saved.");
}

export async function saveNearby(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = str(fd, "id");
    const icon = zIcon.safeParse(fd.get("icon"));
    if (!icon.success) fieldError("icon", "Choose an icon.");
    const place: NearbyPlace = {
      id: id || newId(),
      icon: icon.data,
      name: parseL(fd, "name", { max: 120, label: "Name" }),
      distance: parseL(fd, "distance", { max: 60, label: "Distance" }),
      note: parseL(fd, "note", { max: 200, required: false }),
    };
    const list = await loadSetting("nearby");
    if (id && !list.some((p) => p.id === id)) throw new ActionError("That place no longer exists. Refresh the page.");
    const next = id ? list.map((p) => (p.id === id ? place : p)) : [...list, place];
    if (next.length > 15) throw new ActionError("Keep the list to 15 places or fewer.");
    await updateSetting("nearby", next);
    await writeAudit({ userId: staff.id, action: id ? "website.nearby_update" : "website.nearby_add", entity: "Setting", entityId: "nearby" });
  }, "Place saved.");
}

export async function deleteNearby(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const list = await loadSetting("nearby");
    await updateSetting("nearby", list.filter((p) => p.id !== str(fd, "id")));
    await writeAudit({ userId: staff.id, action: "website.nearby_delete", entity: "Setting", entityId: "nearby" });
  }, "Place removed.");
}

export async function moveNearby(fd: FormData) {
  return adminAction("content:write", async () => {
    const list = await loadSetting("nearby");
    await updateSetting("nearby", moveItem(list, str(fd, "id"), zDir.parse(fd.get("dir"))));
  }, "Order updated.");
}

/* ───────── Contact & hours ───────── */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveContact(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const errors: Record<string, string[]> = {};
    const phone = str(fd, "phone");
    const digits = phone.replace(/\D/g, "");
    if (phone && (!/^[+\d\s()-]+$/.test(phone) || digits.length < 10 || digits.length > 13))
      errors.phone = ["Enter a phone number with its STD code, e.g. 0124-6201611 or 98765 43210."];
    const whatsapp = str(fd, "whatsapp");
    const wa = whatsapp.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, "");
    if (whatsapp && !/^[6-9]\d{9}$/.test(wa))
      errors.whatsapp = ["WhatsApp needs a 10-digit mobile number (landlines cannot receive WhatsApp)."];
    const email = str(fd, "email").toLowerCase();
    if (email && !z.string().email().max(254).safeParse(email).success) errors.email = ["Enter a valid email address."];
    const instagram = str(fd, "instagram")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "");
    if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) errors.instagram = ["Enter the Instagram handle, e.g. hotelasthara_rohtak."];
    const url = (k: string) => {
      const v = str(fd, k);
      if (v && !/^https:\/\/[^\s]+$/.test(v)) errors[k] = ["Use a full link starting with https://, or leave it empty."];
      return v;
    };
    const facebook = url("facebook");
    const googleBusinessUrl = url("googleBusinessUrl");
    const alwaysOpenFrontDesk = fd.get("alwaysOpenFrontDesk") === "on";
    const time = (k: string, label: string) => {
      const v = str(fd, k);
      if (!TIME.test(v)) errors[k] = [`Enter ${label} as HH:MM (24-hour).`];
      return v;
    };
    const checkInTime = time("checkInTime", "the check-in time");
    const checkOutTime = time("checkOutTime", "the check-out time");
    const deskOpens = time("deskOpens", "the opening time");
    const deskCloses = time("deskCloses", "the closing time");
    if (!alwaysOpenFrontDesk && !errors.deskOpens && !errors.deskCloses && deskOpens === deskCloses)
      errors.deskCloses = ["Opening and closing times cannot be the same. Tick 'Open 24 hours' instead."];
    if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);
    await updateSetting("contact", { phone, whatsapp: whatsapp ? wa : "", email, instagram, facebook, googleBusinessUrl });
    await updateSetting("hotel", { alwaysOpenFrontDesk, deskOpens, deskCloses, checkInTime, checkOutTime });
    await writeAudit({ userId: staff.id, action: "website.contact_save", entity: "Setting", entityId: "contact" });
  }, "Contact details and hours saved.");
}

/* ───────── Policies ───────── */

const POLICY_KEYS = ["cancellation", "checkIn", "terms", "privacy"] as const;

export async function savePolicy(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const key = z.enum([...POLICY_KEYS, "idPolicy"]).parse(fd.get("key"));
    if (key === "idPolicy") {
      await updateSetting("policies", { idPolicy: parseL(fd, "body", { max: 2000, long: true, label: "ID policy" }) });
    } else {
      const doc = {
        title: parseL(fd, "title", { max: 120, label: "Title" }),
        body: parseL(fd, "body", { max: 20000, long: true, label: "Text" }),
      };
      await updateSetting("policies", { [key]: doc });
    }
    await writeAudit({ userId: staff.id, action: "website.policy_save", entity: "Setting", entityId: `policies.${key}` });
  }, "Policy saved.");
}

/* ───────── FAQs ───────── */

export async function saveFaq(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = str(fd, "id");
    const faq = { id: id || newId(), q: parseL(fd, "q", { max: 300, label: "Question" }), a: parseL(fd, "a", { max: 2000, long: true, label: "Answer" }) };
    const list = await loadSetting("faqs");
    if (id && !list.some((f) => f.id === id)) throw new ActionError("That question no longer exists. Refresh the page.");
    const next = id ? list.map((f) => (f.id === id ? faq : f)) : [...list, faq];
    if (next.length > 40) throw new ActionError("Keep the FAQ to 40 questions or fewer.");
    await updateSetting("faqs", next);
    await writeAudit({ userId: staff.id, action: id ? "website.faq_update" : "website.faq_add", entity: "Setting", entityId: "faqs" });
  }, "Question saved.");
}

export async function deleteFaq(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const list = await loadSetting("faqs");
    await updateSetting("faqs", list.filter((f) => f.id !== str(fd, "id")));
    await writeAudit({ userId: staff.id, action: "website.faq_delete", entity: "Setting", entityId: "faqs" });
  }, "Question removed.");
}

export async function moveFaq(fd: FormData) {
  return adminAction("content:write", async () => {
    const list = await loadSetting("faqs");
    await updateSetting("faqs", moveItem(list, str(fd, "id"), zDir.parse(fd.get("dir"))));
  }, "Order updated.");
}

/* ───────── SEO ───────── */

export async function saveSeoDefaults(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const titleTemplate = str(fd, "titleTemplate");
    if (!titleTemplate.includes("%s")) fieldError("titleTemplate", "Include %s where the page title goes, e.g. “%s | Hotel Asthara”.");
    if (titleTemplate.length > 80) fieldError("titleTemplate", "Keep it under 80 characters.");
    const keywords = str(fd, "keywords")
      .split(",")
      .map((k) => k.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, 20);
    if (keywords.some((k) => k.length > 80)) fieldError("keywords", "Each keyword should be under 80 characters.");
    await updateSetting("seo", {
      titleTemplate,
      defaultTitle: parseL(fd, "defaultTitle", { max: 120, label: "Home page title" }),
      defaultDescription: parseL(fd, "defaultDescription", { max: 320, label: "Description" }),
      keywords,
      ogImageUrl: zImageUrl.parse(str(fd, "ogImageUrl")),
    });
    await writeAudit({ userId: staff.id, action: "website.seo_save", entity: "Setting", entityId: "seo" });
  }, "SEO defaults saved.");
}

export async function saveSeoPage(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const page = z.enum(SEO_PAGE_KEYS).parse(fd.get("page"));
    const seo = await loadSetting("seo");
    const entry = {
      title: parseL(fd, "title", { max: 120, label: "Title" }),
      description: parseL(fd, "description", { max: 320, label: "Description" }),
    };
    await updateSetting("seo", { pages: { ...seo.pages, [page]: entry } });
    await writeAudit({ userId: staff.id, action: "website.seo_page_save", entity: "Setting", entityId: `seo.${page}` });
  }, "Page SEO saved.");
}
