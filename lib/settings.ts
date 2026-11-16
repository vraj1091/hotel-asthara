import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { DEFAULT_SECTIONS, DEFAULT_SETTINGS } from "@/lib/defaults";
import type { L, SectionKey, SectionRow, SiteSettings } from "@/types/content";

export const SETTINGS_TAG = "settings";
export const SECTIONS_TAG = "sections";

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isL = (v: unknown): v is L => isPlain(v) && "en" in v && "hi" in v;

/** Same keys and nesting as `v`, with every text emptied: the shape to upgrade a new list item against. */
function blankLike(v: unknown): unknown {
  if (isL(v)) return { en: "", hi: "" };
  if (typeof v === "string") return "";
  if (isPlain(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankLike(x)]));
  return v;
}

/** Deep merge where arrays and primitives from `override` replace the defaults.
 *  A plain string saved before a field became bilingual is upgraded to { en, hi }. When the saved English is
 *  still the default text and no Hindi was saved, the default Hindi translation is used. */
export function deepMerge<T>(base: T, override: unknown): T {
  if (isL(base)) {
    if (typeof override === "string") return { en: override, hi: override === base.en ? base.hi : "" } as T;
    if (isL(override) && typeof override.hi === "string" && !override.hi.trim() && override.en === base.en) {
      return { en: override.en, hi: base.hi } as T;
    }
  }
  if (Array.isArray(base) && Array.isArray(override) && base.length && isPlain(base[0])) {
    // Lists of objects (FAQs, nearby places): upgrade each saved item against the default with the same id,
    // or against an empty version of the first default's shape for items the owner added.
    const defaults = base as Plain[];
    const blank = blankLike(defaults[0]);
    return override.map((item) => {
      if (!isPlain(item)) return item;
      const match = item.id !== undefined ? defaults.find((d) => d.id === item.id) : undefined;
      return deepMerge(match ?? blank, item);
    }) as T;
  }
  if (!isPlain(base) || !isPlain(override)) return (override === undefined ? base : override) as T;
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge((base as Plain)[k], v) : v;
  }
  return out as T;
}

async function loadSettings(): Promise<SiteSettings> {
  // Throws on database errors on purpose: unstable_cache never stores a thrown result, so a brief outage
  // (or a build without a database) cannot leave default values cached for the next five minutes.
  {
    const rows = await db.setting.findMany();
    let merged: SiteSettings = DEFAULT_SETTINGS;
    for (const row of rows) {
      if (row.key in DEFAULT_SETTINGS) {
        merged = {
          ...merged,
          [row.key]: deepMerge(DEFAULT_SETTINGS[row.key as keyof SiteSettings], row.value),
        };
      }
    }
    return merged;
  }
}

const cachedSettings = unstable_cache(loadSettings, ["site-settings"], {
  tags: [SETTINGS_TAG],
  revalidate: 300,
});

/** The site still renders its basics if the database is briefly unreachable. */
export async function getSettings(): Promise<SiteSettings> {
  try {
    return await cachedSettings();
  } catch (error) {
    console.error("[settings] falling back to defaults:", error);
    return DEFAULT_SETTINGS;
  }
}

async function loadSections(): Promise<SectionRow[]> {
  {
    const rows = await db.pageSection.findMany({ orderBy: { sortOrder: "asc" } });
    if (rows.length === 0) return DEFAULT_SECTIONS;
    const byKey = new Map(rows.map((r) => [r.key, r]));
    // Keep any section the database has not seen yet (added in a later release) at the end.
    const known = rows.map((r) => ({
      key: r.key as SectionKey,
      enabled: r.enabled,
      sortOrder: r.sortOrder,
      content: deepMerge(DEFAULT_SECTIONS.find((d) => d.key === r.key)?.content ?? {}, r.content),
    }));
    const missing = DEFAULT_SECTIONS.filter((d) => !byKey.has(d.key)).map((d, i) => ({
      ...d,
      sortOrder: 1000 + i,
    }));
    return [...known, ...missing] as SectionRow[];
  }
}

const cachedSections = unstable_cache(loadSections, ["page-sections"], {
  tags: [SECTIONS_TAG],
  revalidate: 300,
});

export async function getSections(): Promise<SectionRow[]> {
  try {
    return await cachedSections();
  } catch (error) {
    console.error("[sections] falling back to defaults:", error);
    return DEFAULT_SECTIONS;
  }
}

/** Pick the right language, falling back to English when a Hindi string is empty. */
export function tr(text: L | string | undefined | null, locale: string): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return (locale === "hi" ? text.hi || text.en : text.en) ?? "";
}

/** Raw settings row (not merged), e.g. the encrypted payment secrets that never reach SiteSettings. */
export async function getRawSetting<T>(key: string): Promise<T | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? null;
}
