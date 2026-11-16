import { TriangleAlert } from "lucide-react";
import { ActionForm, BilingualField, SubmitButton } from "@/components/admin/forms";
import { AdminCard } from "@/components/admin/ui";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { saveAmenities } from "@/features/cms/admin-actions";
import { loadSection, loadSetting } from "@/features/cms/admin-shared";
import { AMENITY_CATALOG, type AmenityDef } from "@/lib/amenities";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Amenities | Website editor" };

function AmenityChecks({ items, enabled }: { items: AmenityDef[]; enabled: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((a) => (
        <li key={a.key}>
          <label className="border-line hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft flex cursor-pointer items-center gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              name="amenity"
              value={a.key}
              defaultChecked={enabled.includes(a.key)}
              className="accent-[var(--color-accent)] size-5 shrink-0"
            />
            <span className="theme-dark bg-bg text-accent grid size-9 shrink-0 place-items-center rounded-lg">
              <AmenityIcon name={a.icon} className="size-4" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{a.label}</span>
              <span className="text-muted block" lang="hi">
                {a.labelHi}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export default async function AmenitiesEditorPage() {
  await requirePage("content:write");
  const [amenities, section] = await Promise.all([loadSetting("amenities"), loadSection("AMENITIES")]);
  const core = AMENITY_CATALOG.filter((a) => a.core);
  const extras = AMENITY_CATALOG.filter((a) => !a.core);
  return (
    <>
      <WebsiteHeader
        current="amenities"
        viewHref="/#amenities"
        description="Which amenities the website says the hotel offers. They appear on the homepage, the About page and in search-engine data."
      />
      <ActionForm action={saveAmenities} className="grid gap-6">
        <p className="border-warning/40 bg-warning/10 text-ink flex items-start gap-3 rounded-xl border p-4 text-sm">
          <TriangleAlert className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
          Only switch on what the hotel really offers today. Guests rely on this list when they book.
        </p>
        <AdminCard title="Offered today" description="What the hotel currently states it offers.">
          <AmenityChecks items={core} enabled={amenities.enabled} />
        </AdminCard>
        <AdminCard title="Extras" description="Off until you confirm the hotel has them.">
          <AmenityChecks items={extras} enabled={amenities.enabled} />
        </AdminCard>
        <AdminCard title="Homepage heading">
          <div className="grid gap-6">
            <BilingualField name="title" label="Heading" defaultValue={section.title} maxLength={160} />
            <BilingualField
              name="intro"
              label="Introduction"
              multiline
              rows={2}
              required={false}
              defaultValue={section.intro}
              maxLength={600}
            />
          </div>
        </AdminCard>
        <SubmitButton className="w-fit">Save amenities</SubmitButton>
      </ActionForm>
    </>
  );
}
