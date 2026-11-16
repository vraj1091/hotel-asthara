import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { deepMerge, SECTIONS_TAG, SETTINGS_TAG } from "@/lib/settings";
import type { SectionKey, SectionRow, SiteSettings } from "@/types/content";

/**
 * The only way admin code writes site settings. `patch` is merged into the current stored value, so two screens that
 * edit different fields of the same key (e.g. Settings → Hotel and Website → Location both touch `hotel`) never
 * overwrite each other. Arrays are replaced as a whole.
 */
export async function updateSetting<K extends keyof SiteSettings>(
  key: K,
  patch: Partial<SiteSettings[K]> | SiteSettings[K],
) {
  const row = await db.setting.findUnique({ where: { key } });
  const current = deepMerge(DEFAULT_SETTINGS[key], row?.value);
  const next = Array.isArray(patch) ? patch : { ...(current as object), ...(patch as object) };
  await db.setting.upsert({
    where: { key },
    create: { key, value: next as Prisma.InputJsonValue },
    update: { value: next as Prisma.InputJsonValue },
  });
  revalidateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  return next as SiteSettings[K];
}

/** Homepage section: content patch, visibility and order. */
export async function updateSection(
  key: SectionKey,
  data: { enabled?: boolean; sortOrder?: number; content?: Partial<SectionRow["content"]> },
) {
  const row = await db.pageSection.findUnique({ where: { key } });
  const content = data.content
    ? ({ ...((row?.content as object) ?? {}), ...data.content } as Prisma.InputJsonValue)
    : undefined;
  await db.pageSection.upsert({
    where: { key },
    create: {
      key,
      enabled: data.enabled ?? true,
      sortOrder: data.sortOrder ?? 0,
      content: content ?? {},
    },
    update: {
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(content ? { content } : {}),
    },
  });
  revalidateTag(SECTIONS_TAG);
  revalidatePath("/", "layout");
}
