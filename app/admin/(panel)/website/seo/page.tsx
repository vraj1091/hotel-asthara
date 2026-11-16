import { ExternalLink } from "lucide-react";
import { ActionForm, FormField, SubmitButton } from "@/components/admin/forms";
import { MediaPickerField } from "@/components/admin/media-picker";
import { AdminCard } from "@/components/admin/ui";
import { CountedBilingualField } from "@/components/admin/website/counted-field";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { Input, Textarea } from "@/components/ui/input";
import { saveSeoDefaults, saveSeoPage } from "@/features/cms/admin-actions";
import { SEO_PAGE_INFO, SEO_PAGE_KEYS } from "@/features/cms/admin-constants";
import { loadSetting } from "@/features/cms/admin-shared";
import { slotImage } from "@/lib/image-slots";
import { requirePage } from "@/lib/session";

export const metadata = { title: "SEO | Website editor" };

const EMPTY = { en: "", hi: "" };

export default async function SeoEditorPage() {
  await requirePage("content:write");
  const [seo, og] = await Promise.all([loadSetting("seo"), slotImage("og")]);
  return (
    <>
      <WebsiteHeader
        current="seo"
        viewHref="/"
        description="How the site appears in Google and when links are shared on WhatsApp or social media. Hindi pages live at the same address with ?lang=hi."
      />
      <div className="grid gap-6">
        <AdminCard title="Site-wide defaults">
          <ActionForm action={saveSeoDefaults} className="grid gap-6">
            <FormField
              name="titleTemplate"
              label="Title pattern for inner pages"
              hint="%s is replaced by the page title, e.g. “Rooms and rates | Hotel Asthara, Rohtak”."
              className="max-w-xl"
            >
              <Input required maxLength={80} defaultValue={seo.titleTemplate} />
            </FormField>
            <CountedBilingualField name="defaultTitle" label="Home page title" defaultValue={seo.defaultTitle} recommended={60} max={120} />
            <CountedBilingualField
              name="defaultDescription"
              label="Home page description"
              defaultValue={seo.defaultDescription}
              recommended={155}
              max={320}
              multiline
            />
            <FormField name="keywords" label="Keywords" optional hint="Separated by commas. Search engines give these little weight; titles and descriptions matter more.">
              <Textarea rows={2} className="min-h-0" maxLength={2000} defaultValue={seo.keywords.join(", ")} />
            </FormField>
            <MediaPickerField
              name="ogImageUrl"
              label="Sharing image"
              folder="general"
              defaultValue={seo.ogImageUrl}
              aspect="aspect-[1200/630] max-w-md"
              slotFallback={og?.url ?? null}
              hint="Shown when the site is shared. 1200 × 630 px works best. If none is chosen, og.jpg from /public/images/hotel or a generated card with the hotel name is used."
            />
            <SubmitButton className="w-fit">Save defaults</SubmitButton>
          </ActionForm>
        </AdminCard>

        {SEO_PAGE_KEYS.map((key) => {
          const page = seo.pages[key] ?? { title: EMPTY, description: EMPTY };
          const info = SEO_PAGE_INFO[key];
          return (
            <AdminCard
              key={key}
              title={info.label}
              description={info.path}
              actions={
                <a href={info.path} target="_blank" rel="noopener noreferrer" className="link-underline flex items-center gap-1.5 text-sm">
                  <ExternalLink className="size-4" aria-hidden /> View page
                </a>
              }
            >
              <ActionForm action={saveSeoPage} className="grid gap-5">
                <input type="hidden" name="page" value={key} />
                <CountedBilingualField
                  name="title"
                  label="Title"
                  defaultValue={page.title}
                  recommended={45}
                  max={120}
                  hint="The title pattern above adds the hotel name, so keep this part short."
                />
                <CountedBilingualField
                  name="description"
                  label="Description"
                  defaultValue={page.description}
                  recommended={155}
                  max={320}
                  multiline
                />
                <SubmitButton size="sm" className="w-fit">
                  Save {info.label.toLowerCase()} page
                </SubmitButton>
              </ActionForm>
            </AdminCard>
          );
        })}
      </div>
    </>
  );
}
