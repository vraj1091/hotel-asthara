"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { TESTIMONIALS_TAG } from "@/features/cms/queries";
import { ActionError } from "@/lib/action";
import { adminAction } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/sanitize";
import { updateSetting } from "@/lib/settings-write";
import { str } from "./admin-shared";

const zId = z.string().min(1).max(40);

function refresh() {
  revalidateTag(TESTIMONIALS_TAG);
  revalidatePath("/");
}

const reviewSchema = z.object({
  name: z.string().transform((s) => cleanText(s, 80)).pipe(z.string().min(2, "Enter the guest's name.")),
  location: z.string().optional().transform((s) => cleanText(s ?? "", 80) || null),
  rating: z.coerce.number().int("Choose 1 to 5 stars.").min(1, "Choose 1 to 5 stars.").max(5, "Choose 1 to 5 stars."),
  body: z
    .string()
    .transform((s) => cleanText(s, 1000))
    .pipe(z.string().min(10, "Paste the review text (at least 10 characters).")),
  source: z.string().optional().transform((s) => cleanText(s ?? "", 60) || null),
  approved: z.string().optional().transform((v) => v === "on"),
  featured: z.string().optional().transform((v) => v === "on"),
});

export async function saveTestimonial(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = str(fd, "id");
    const data = reviewSchema.parse(Object.fromEntries(fd));
    if (id) {
      const found = await db.testimonial.findFirst({ where: { id, deletedAt: null } });
      if (!found) throw new ActionError("That review no longer exists. Refresh the page.");
      await db.testimonial.update({ where: { id }, data });
    } else {
      await db.testimonial.create({ data });
    }
    await writeAudit({ userId: staff.id, action: id ? "review.update" : "review.create", entity: "Testimonial", entityId: id || null, meta: { name: data.name } });
    refresh();
  }, "Review saved.");
}

export async function setTestimonialFlag(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const flag = z.enum(["approved", "featured"]).parse(fd.get("flag"));
    const value = fd.get("value") === "1";
    await db.testimonial.update({ where: { id }, data: { [flag]: value } });
    await writeAudit({ userId: staff.id, action: `review.${flag}`, entity: "Testimonial", entityId: id, meta: { value } });
    refresh();
    return { message: flag === "approved" ? (value ? "Review approved and shown on the site." : "Review hidden from the site.") : value ? "Review featured." : "Review no longer featured." };
  }).then((r) => (r.ok ? { ...r, message: r.data.message } : r));
}

export async function deleteTestimonial(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    await db.testimonial.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ userId: staff.id, action: "review.delete", entity: "Testimonial", entityId: id });
    refresh();
  }, "Review deleted.");
}

export async function saveRating(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const errors: Record<string, string[]> = {};
    const rawValue = str(fd, "value");
    const rawCount = str(fd, "count");
    let value: number | null = null;
    let count: number | null = null;
    if (rawValue) {
      const v = Number(rawValue);
      if (!Number.isFinite(v) || v < 1 || v > 5) errors.value = ["Enter a rating from 1.0 to 5.0."];
      else value = Math.round(v * 10) / 10;
      const c = Number(rawCount);
      if (!Number.isInteger(c) || c < 1 || c > 1_000_000) errors.count = ["Enter how many reviews the rating is based on."];
      else count = c;
    }
    const source = cleanText(str(fd, "source"), 40);
    const sourceUrl = str(fd, "sourceUrl");
    if (value !== null && !source) errors.source = ["Say where the rating comes from, e.g. Google."];
    if (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl)) errors.sourceUrl = ["Use a full link starting with https://"];
    if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);
    await updateSetting("rating", { value, count, source, sourceUrl });
    await writeAudit({ userId: staff.id, action: "website.rating_save", entity: "Setting", entityId: "rating", meta: { value, count, source } });
  }, "Rating saved.");
}
