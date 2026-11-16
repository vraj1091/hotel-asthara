import Image from "next/image";
import { Eye, EyeOff, ImageOff, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, BilingualField, Checkbox, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { AdminCard, EmptyState } from "@/components/admin/ui";
import { GalleryAdd } from "@/components/admin/website/gallery-add";
import { MoveButtons, WebsiteHeader } from "@/components/admin/website/website-header";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import {
  deleteGalleryCategory,
  moveGalleryCategory,
  moveGalleryImage,
  removeGalleryImage,
  saveGalleryCategory,
  toggleGalleryVisible,
  updateGalleryImage,
} from "@/features/cms/admin-gallery";
import { loadSetting } from "@/features/cms/admin-shared";
import { db } from "@/lib/db";
import { gallerySlotImages } from "@/lib/image-slots";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Gallery | Website editor" };

export default async function GalleryEditorPage() {
  await requirePage("content:write");
  const [{ categories }, images, slots] = await Promise.all([
    loadSetting("gallery"),
    db.galleryImage.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    gallerySlotImages().catch(() => []),
  ]);
  const label = (key: string) => categories.find((c) => c.key === key)?.label.en ?? key;
  const usage = (key: string) => images.filter((i) => i.category === key).length;

  return (
    <>
      <WebsiteHeader
        current="gallery"
        viewHref="/gallery"
        description="Photos on the Gallery page and the homepage gallery, grouped by category."
      />
      <div className="grid gap-6">
        <AdminCard
          title={`Gallery photos (${images.length})`}
          description="Visitors see visible photos in this order. The homepage shows the first few."
        >
          <div className="grid gap-6">
            <GalleryAdd categories={categories.map((c) => ({ key: c.key, label: c.label.en }))} />
            {images.length === 0 ? (
              <EmptyState
                icon={<ImageOff />}
                title="No gallery photos yet"
                body="Choose a category and add photos from the media library. Upload new ones from the same window."
              />
            ) : (
              <ol className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {images.map((img, i) => (
                  <li key={img.id} className="border-line grid content-start gap-3 rounded-xl border p-3">
                    <div className="bg-surface-3 relative aspect-[4/3] overflow-hidden rounded-lg">
                      <Image
                        src={img.url}
                        alt={img.alt}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className={img.visible ? "object-cover" : "object-cover opacity-50"}
                      />
                      <span className="absolute top-2 left-2 flex gap-1.5">
                        <Badge tone="dark">{label(img.category)}</Badge>
                        {img.visible ? null : <Badge tone="warning">Hidden</Badge>}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted text-sm tabular-nums">#{i + 1}</span>
                      <div className="flex items-center gap-1">
                        <MoveButtons action={moveGalleryImage} fields={{ id: img.id }} first={i === 0} last={i === images.length - 1} label={img.alt || "photo"} />
                        <ActionButton
                          action={toggleGalleryVisible}
                          fields={{ id: img.id, visible: img.visible ? "0" : "1" }}
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          aria-label={img.visible ? "Hide photo" : "Show photo"}
                        >
                          {img.visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                        </ActionButton>
                        <ConfirmButton
                          action={removeGalleryImage}
                          fields={{ id: img.id }}
                          title="Remove this photo from the gallery?"
                          body="It stays in the media library and can be added again."
                          confirmLabel="Remove"
                          size="icon"
                          variant="ghost"
                          className="text-danger size-9"
                          aria-label="Remove from gallery"
                        >
                          <Trash2 aria-hidden />
                        </ConfirmButton>
                      </div>
                    </div>
                    <details>
                      <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">
                        Edit description and category
                      </summary>
                      <ActionForm action={updateGalleryImage} className="mt-4 grid gap-4">
                        <input type="hidden" name="id" value={img.id} />
                        <FormField name="category" label="Category">
                          <NativeSelect defaultValue={img.category}>
                            {categories.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label.en}
                              </option>
                            ))}
                          </NativeSelect>
                        </FormField>
                        <BilingualField
                          name="alt"
                          label="Description (alt text)"
                          defaultValue={{ en: img.alt, hi: img.altHi }}
                          maxLength={200}
                          hint="Shown in the photo viewer and read aloud by screen readers."
                        />
                        <Checkbox name="visible" label="Show on the website" defaultChecked={img.visible} />
                        <SubmitButton size="sm" className="w-fit">
                          Save photo
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-muted text-sm">
              Photos placed in <code className="bg-surface-3 rounded px-1.5 py-0.5">/public/images/hotel/gallery/&lt;category&gt;/</code> also appear,
              after these.{" "}
              {slots.length
                ? `${slots.length} photo${slots.length === 1 ? " is" : "s are"} there now.`
                : "There are none there at the moment."}
            </p>
          </div>
        </AdminCard>

        <AdminCard
          title="Categories"
          description="The filter buttons on the Gallery page. The key is also the folder name for photo slots."
        >
          <ol className="grid gap-3">
            {categories.map((c, i) => {
              const used = usage(c.key);
              return (
                <li key={c.key} className="border-line rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>
                      <span className="font-medium">{c.label.en}</span>
                      {c.label.hi ? <span className="text-muted" lang="hi"> · {c.label.hi}</span> : null}
                      <span className="text-muted ml-2 text-sm">
                        {c.key} · {used} photo{used === 1 ? "" : "s"}
                      </span>
                    </p>
                    <div className="flex items-center gap-1">
                      <MoveButtons action={moveGalleryCategory} fields={{ key: c.key }} first={i === 0} last={i === categories.length - 1} label={c.label.en} />
                      <ConfirmButton
                        action={deleteGalleryCategory}
                        fields={{ key: c.key }}
                        title={`Remove the “${c.label.en}” category?`}
                        body={used ? `${used} photo(s) use it. Move them to another category first.` : "Its filter button disappears from the Gallery page."}
                        confirmLabel="Remove"
                        size="icon"
                        variant="ghost"
                        className="text-danger size-9"
                        aria-label={`Remove category ${c.label.en}`}
                      >
                        <Trash2 aria-hidden />
                      </ConfirmButton>
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">Rename</summary>
                    <CategoryForm category={c} />
                  </details>
                </li>
              );
            })}
          </ol>
          {categories.length < 12 ? (
            <details className="border-line-strong mt-4 rounded-xl border border-dashed p-4">
              <summary className="w-fit cursor-pointer text-sm font-medium">Add a category</summary>
              <CategoryForm />
            </details>
          ) : null}
        </AdminCard>
      </div>
    </>
  );
}

function CategoryForm({ category }: { category?: { key: string; label: { en: string; hi: string } } }) {
  return (
    <ActionForm action={saveGalleryCategory} resetOnSuccess={!category} className="mt-4 grid gap-4">
      {category ? <input type="hidden" name="originalKey" value={category.key} /> : null}
      <BilingualField name="label" label="Name" defaultValue={category?.label} maxLength={40} />
      <FormField
        name="key"
        label="Key"
        hint="Lower-case letters, numbers and hyphens, e.g. dining. Changing it moves its photos along."
        className="max-w-sm"
      >
        <Input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} defaultValue={category?.key} />
      </FormField>
      <SubmitButton size="sm" className="w-fit">
        {category ? "Save category" : "Add category"}
      </SubmitButton>
    </ActionForm>
  );
}
