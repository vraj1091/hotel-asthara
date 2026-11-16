import { ActionForm, BilingualField, SubmitButton } from "@/components/admin/forms";
import { MediaPickerField } from "@/components/admin/media-picker";
import { AdminCard } from "@/components/admin/ui";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { saveAbout } from "@/features/cms/admin-actions";
import { loadSetting } from "@/features/cms/admin-shared";
import { slotImage } from "@/lib/image-slots";
import { requirePage } from "@/lib/session";

export const metadata = { title: "About | Website editor" };

export default async function AboutEditorPage() {
  await requirePage("content:write");
  const [about, slot] = await Promise.all([loadSetting("about"), slotImage("about")]);
  return (
    <>
      <WebsiteHeader current="about" viewHref="/about" description="The story of the hotel on the About page." />
      <ActionForm action={saveAbout} className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <AdminCard title="Text">
          <div className="grid gap-6">
            <BilingualField name="title" label="Page title" defaultValue={about.title} maxLength={120} />
            <BilingualField
              name="intro"
              label="Short introduction"
              required={false}
              multiline
              rows={2}
              defaultValue={about.intro}
              maxLength={300}
            />
            <BilingualField
              name="body"
              label="Main text"
              multiline
              rows={12}
              defaultValue={about.body}
              maxLength={8000}
              hint="Leave a blank line between paragraphs."
            />
          </div>
        </AdminCard>
        <AdminCard title="Photo" className="self-start">
          <MediaPickerField
            name="imageUrl"
            label="About page photo"
            folder="about"
            defaultValue={about.imageUrl}
            aspect="aspect-[4/3]"
            slotFallback={slot?.url ?? null}
            hint="If none is chosen, about.jpg from /public/images/hotel is used, otherwise the arch placeholder."
          />
        </AdminCard>
        <div className="lg:col-span-2">
          <SubmitButton>Save about page</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
