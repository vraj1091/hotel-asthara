import Link from "next/link";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { ActionButton } from "@/components/admin/forms";
import { AdminCard } from "@/components/admin/ui";
import { MoveButtons, WebsiteHeader } from "@/components/admin/website/website-header";
import { SectionEditor } from "@/components/admin/website/section-editor";
import { Badge } from "@/components/ui/badge";
import { moveSection, toggleSection } from "@/features/cms/admin-actions";
import { FIXED_SECTION, SECTION_LABELS } from "@/lib/defaults";
import { requirePage } from "@/lib/session";
import { getSections, tr } from "@/lib/settings";
import type { SectionKey } from "@/types/content";

export const metadata = { title: "Website editor" };

const NOTES: Partial<Record<SectionKey, string>> = {
  ROOMS_GRID: "Room cards come from Rooms & rates.",
  OFFERS: "Shows active offers from Offers & promo codes. Hidden automatically when there are none.",
  GALLERY: "Shows the first photos from the Gallery tab. Hidden automatically when there are none.",
  TESTIMONIALS: "Shows approved reviews from the Reviews tab. Hidden automatically when there are none.",
  LOCATION: "Map and nearby places come from the Location tab.",
  FAQ: "Questions come from the FAQs tab.",
  CONTACT: "Phone, WhatsApp and email come from the Contact & hours tab.",
  AMENITIES: "Which amenities show is set on the Amenities tab.",
  INSTAGRAM_FEED: "Hidden automatically when there are no posts.",
};

export default async function WebsiteHomePage() {
  await requirePage("content:write");
  const sections = await getSections();
  const hero = sections.find((s) => s.key === FIXED_SECTION);
  const rest = sections.filter((s) => s.key !== FIXED_SECTION).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <WebsiteHeader
        current="home"
        viewHref="/"
        description="Choose which sections the homepage shows, in what order, and edit their headings in English and Hindi."
      />
      <div className="grid gap-4">
        {hero ? (
          <AdminCard
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-muted tabular-nums">1.</span> Hero
                <Badge tone="success">Always shown</Badge>
              </span>
            }
            description="The first thing guests see: headline, photo and the booking bar."
            actions={
              <Link href="/admin/website/hero" className="link-underline flex items-center gap-1.5 text-sm">
                <Pencil className="size-4" aria-hidden /> Edit hero
              </Link>
            }
            bodyClassName="hidden"
          >
            {null}
          </AdminCard>
        ) : null}
        {rest.map((s, i) => (
          <AdminCard
            key={s.key}
            className={s.enabled ? undefined : "opacity-80"}
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-muted tabular-nums">{i + 2}.</span> {SECTION_LABELS[s.key]}
                {s.enabled ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>}
              </span>
            }
            description={
              <>
                {"title" in s.content ? <span className="text-ink">“{tr(s.content.title, "en")}”</span> : null}
                {NOTES[s.key] ? <span className="block">{NOTES[s.key]}</span> : null}
              </>
            }
            actions={
              <>
                <MoveButtons
                  action={moveSection}
                  fields={{ key: s.key }}
                  first={i === 0}
                  last={i === rest.length - 1}
                  label={SECTION_LABELS[s.key]}
                />
                <ActionButton
                  action={toggleSection}
                  fields={{ key: s.key, enabled: s.enabled ? "0" : "1" }}
                  size="sm"
                  variant="outline"
                >
                  {s.enabled ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  {s.enabled ? "Hide" : "Show"}
                </ActionButton>
              </>
            }
          >
            <details className="group">
              <summary className="text-ink hover:text-accent-strong flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium [&::-webkit-details-marker]:hidden">
                <Pencil className="size-4" aria-hidden />
                <span className="group-open:hidden">Edit content</span>
                <span className="hidden group-open:inline">Close editor</span>
              </summary>
              <div className="mt-5">
                <SectionEditor section={s} />
              </div>
            </details>
          </AdminCard>
        ))}
      </div>
    </>
  );
}
