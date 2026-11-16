import { ActionForm, BilingualField, FormField, SubmitButton } from "@/components/admin/forms";
import { MediaPickerField } from "@/components/admin/media-picker";
import { AdminCard } from "@/components/admin/ui";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { Input } from "@/components/ui/input";
import { saveHero } from "@/features/cms/admin-actions";
import { loadSection } from "@/features/cms/admin-shared";
import { slotImage } from "@/lib/image-slots";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Hero | Website editor" };

export default async function HeroEditorPage() {
  await requirePage("content:write");
  const [hero, slot] = await Promise.all([loadSection("HERO"), slotImage("hero")]);
  return (
    <>
      <WebsiteHeader
        current="hero"
        viewHref="/"
        description="The headline, text and photo at the top of the homepage."
      />
      <ActionForm action={saveHero} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <AdminCard title="Text">
          <div className="grid gap-6">
            <BilingualField
              name="headline"
              label="Headline"
              defaultValue={hero.headline}
              maxLength={120}
              hint="Short and clear works best: it is split over two lines on large screens."
            />
            <BilingualField
              name="subhead"
              label="Text under the headline"
              multiline
              rows={3}
              defaultValue={hero.subhead}
              maxLength={400}
            />
          </div>
        </AdminCard>
        <div className="grid content-start gap-6">
          <AdminCard title="Photo">
            <MediaPickerField
              name="imageUrl"
              label="Hero photo"
              folder="hero"
              defaultValue={hero.imageUrl}
              aspect="aspect-[4/5] max-w-72"
              slotFallback={slot?.url ?? null}
              hint="Shown inside the arch. A portrait photo of the room or the hotel works best. If none is chosen, hero.jpg from /public/images/hotel is used, otherwise the arch placeholder."
            />
          </AdminCard>
          <AdminCard title="Background video" description="Optional. Plays muted behind the headline instead of the photo.">
            <div className="grid gap-5">
              <FormField name="videoUrl" label="Video link" optional hint="An https link to an .mp4 or .webm file, ideally under 5 MB.">
                <Input type="url" defaultValue={hero.videoUrl} placeholder="https://…/hotel.mp4" />
              </FormField>
              <MediaPickerField
                name="posterUrl"
                label="Still image shown while the video loads"
                folder="hero"
                defaultValue={hero.posterUrl}
              />
            </div>
          </AdminCard>
        </div>
        <div className="lg:col-span-2">
          <SubmitButton>Save hero</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
