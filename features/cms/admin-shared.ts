import "server-only";
import { randomBytes } from "node:crypto";
import { ActionError } from "@/lib/action";
import { bilingual, bilingualLong } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { DEFAULT_SECTION_CONTENT, DEFAULT_SETTINGS } from "@/lib/defaults";
import { deepMerge } from "@/lib/settings";
import type { L, SectionContent, SectionKey, SiteSettings } from "@/types/content";

/** Read a settings key straight from the database (not the 5-minute cache), merged over the defaults. */
export async function loadSetting<K extends keyof SiteSettings>(key: K): Promise<SiteSettings[K]> {
  const row = await db.setting.findUnique({ where: { key } });
  return deepMerge(DEFAULT_SETTINGS[key], row?.value);
}

/** Read a homepage section's content straight from the database, merged over the defaults. */
export async function loadSection<K extends SectionKey>(key: K): Promise<SectionContent[K]> {
  const row = await db.pageSection.findUnique({ where: { key } });
  return deepMerge(DEFAULT_SECTION_CONTENT[key], row?.content);
}

/**
 * English + Hindi pair from a <BilingualField name={name}>. Errors are reported on `${name}En` / `${name}Hi` so they
 * show under the right input.
 */
export function parseL(
  fd: FormData,
  name: string,
  opts: { required?: boolean; max?: number; long?: boolean; label?: string } = {},
): L {
  const { required = true, max = 600, long = false, label = "This field" } = opts;
  const value = long ? bilingualLong(fd, name, max) : bilingual(fd, name, max);
  const errors: Record<string, string[]> = {};
  if (required && !value.en) errors[`${name}En`] = [`${label} in English is required.`];
  const rawEn = String(fd.get(`${name}En`) ?? "");
  const rawHi = String(fd.get(`${name}Hi`) ?? "");
  if (rawEn.length > max) errors[`${name}En`] = [`Keep it under ${max} characters.`];
  if (rawHi.length > max) errors[`${name}Hi`] = [`Keep it under ${max} characters.`];
  if (Object.keys(errors).length) throw new ActionError("Check the highlighted fields and try again.", errors);
  return value;
}

export function fieldError(field: string, message: string): never {
  throw new ActionError(message, { [field]: [message] });
}

export const newId = () => randomBytes(5).toString("hex");

/** Move the item with `id` one place up or down. Returns a new array (unchanged if it cannot move). */
export function moveItem<T extends { id: string }>(list: T[], id: string, dir: "up" | "down"): T[] {
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
