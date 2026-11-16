import { Trash2 } from "lucide-react";
import { ActionForm, BilingualField, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { AdminCard, EmptyState } from "@/components/admin/ui";
import { IconPicker } from "@/components/admin/website/icon-picker";
import { MoveButtons, WebsiteHeader } from "@/components/admin/website/website-header";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { Input } from "@/components/ui/input";
import { deleteNearby, moveNearby, saveLocation, saveNearby } from "@/features/cms/admin-actions";
import { loadSetting } from "@/features/cms/admin-shared";
import { requirePage } from "@/lib/session";
import type { NearbyPlace } from "@/types/content";

export const metadata = { title: "Location | Website editor" };

export default async function LocationEditorPage() {
  await requirePage("content:write");
  const [hotel, nearby] = await Promise.all([loadSetting("hotel"), loadSetting("nearby")]);
  const mapLink = `https://www.google.com/maps?q=${hotel.latitude},${hotel.longitude}`;
  return (
    <>
      <WebsiteHeader
        current="location"
        viewHref="/nearby"
        description="The address, map pin and nearby landmarks shown on the Location page, the homepage and in search results."
      />
      <div className="grid gap-6">
        <AdminCard title="Address and map">
          <ActionForm action={saveLocation} className="grid gap-5">
            <FormField name="addressLine" label="Street address" hint="Floor, building and landmarks guests can look for.">
              <Input required maxLength={300} defaultValue={hotel.addressLine} autoComplete="street-address" />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <FormField name="locality" label="Locality">
                <Input required maxLength={200} defaultValue={hotel.locality} />
              </FormField>
              <FormField name="city" label="City">
                <Input required maxLength={200} defaultValue={hotel.city} />
              </FormField>
              <FormField name="state" label="State">
                <Input required maxLength={200} defaultValue={hotel.state} />
              </FormField>
              <FormField name="postalCode" label="PIN code">
                <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} defaultValue={hotel.postalCode} />
              </FormField>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField name="latitude" label="Latitude" hint="From Google Maps: right-click the hotel and click the numbers.">
                <Input required inputMode="decimal" type="number" step="any" min={-90} max={90} defaultValue={hotel.latitude} />
              </FormField>
              <FormField name="longitude" label="Longitude">
                <Input required inputMode="decimal" type="number" step="any" min={-180} max={180} defaultValue={hotel.longitude} />
              </FormField>
            </div>
            <p className="text-muted text-sm">
              Check the pin:{" "}
              <a href={mapLink} target="_blank" rel="noopener noreferrer" className="link-underline text-ink">
                open these coordinates in Google Maps
              </a>
              .
            </p>
            <FormField
              name="mapsPlaceUrl"
              label="Google Maps link for “Get directions”"
              optional
              hint="Share link of the hotel's Google Maps listing. If empty, directions use the coordinates above."
            >
              <Input type="url" maxLength={500} placeholder="https://maps.app.goo.gl/…" defaultValue={hotel.mapsPlaceUrl} />
            </FormField>
            <SubmitButton className="w-fit">Save address</SubmitButton>
          </ActionForm>
        </AdminCard>

        <AdminCard title={`Nearby places (${nearby.length})`} description="Landmarks that help guests find the hotel.">
          {nearby.length === 0 ? <EmptyState title="No nearby places yet" body="Add landmarks such as the railway station or a market." /> : null}
          <ol className="grid gap-3">
            {nearby.map((p, i) => (
              <li key={p.id} className="border-line rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-3">
                    <span className="theme-dark bg-bg text-accent grid size-9 shrink-0 place-items-center rounded-lg">
                      <AmenityIcon name={p.icon} className="size-4" />
                    </span>
                    <span>
                      <span className="block font-medium">{p.name.en}</span>
                      <span className="text-muted block text-sm">{p.distance.en}</span>
                    </span>
                  </p>
                  <div className="flex items-center gap-1">
                    <MoveButtons action={moveNearby} fields={{ id: p.id }} first={i === 0} last={i === nearby.length - 1} label={p.name.en} />
                    <ConfirmButton
                      action={deleteNearby}
                      fields={{ id: p.id }}
                      title={`Remove “${p.name.en}”?`}
                      confirmLabel="Remove"
                      size="icon"
                      variant="ghost"
                      className="text-danger size-9"
                      aria-label={`Remove ${p.name.en}`}
                    >
                      <Trash2 aria-hidden />
                    </ConfirmButton>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">Edit place</summary>
                  <NearbyForm place={p} />
                </details>
              </li>
            ))}
          </ol>
          {nearby.length < 15 ? (
            <details className="border-line-strong mt-4 rounded-xl border border-dashed p-4">
              <summary className="w-fit cursor-pointer text-sm font-medium">Add a place</summary>
              <NearbyForm />
            </details>
          ) : null}
        </AdminCard>
      </div>
    </>
  );
}

function NearbyForm({ place }: { place?: NearbyPlace }) {
  return (
    <ActionForm action={saveNearby} resetOnSuccess={!place} className="mt-4 grid gap-4">
      {place ? <input type="hidden" name="id" value={place.id} /> : null}
      <IconPicker defaultValue={place?.icon ?? "MapPin"} />
      <BilingualField name="name" label="Name" defaultValue={place?.name} maxLength={120} />
      <BilingualField name="distance" label="Distance" defaultValue={place?.distance} maxLength={60} hint="e.g. “About 4.5 km” or “In front of the hotel”." />
      <BilingualField name="note" label="Note" required={false} defaultValue={place?.note} maxLength={200} />
      <SubmitButton size="sm" className="w-fit">
        {place ? "Save place" : "Add place"}
      </SubmitButton>
    </ActionForm>
  );
}
