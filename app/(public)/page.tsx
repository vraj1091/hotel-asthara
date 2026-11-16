import { renderSection } from "@/components/sections/registry";
import { FIXED_SECTION } from "@/lib/defaults";
import { pageMetadata } from "@/lib/seo";
import { getSections, getSettings } from "@/lib/settings";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { path: "/" });
}

export default async function HomePage() {
  const [settings, sections] = await Promise.all([getSettings(), getSections()]);
  // The hero is always first; everything else follows the order set in Admin → Website.
  const ordered = sections
    .filter((s) => s.enabled)
    .sort((a, b) =>
      a.key === FIXED_SECTION ? -1 : b.key === FIXED_SECTION ? 1 : a.sortOrder - b.sortOrder,
    );
  return (
    <>
      {ordered.map((section) => renderSection(section, settings))}
    </>
  );
}
