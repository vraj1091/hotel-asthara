import Image from "next/image";
import { Trash2 } from "lucide-react";
import { ActionForm, BilingualField, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { MediaPickerField } from "@/components/admin/media-picker";
import { IconPicker } from "@/components/admin/website/icon-picker";
import { MoveButtons } from "@/components/admin/website/website-header";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { Input } from "@/components/ui/input";
import {
  deleteInstagramPost,
  deleteWhyPoint,
  moveInstagramPost,
  moveWhyPoint,
  saveInstagramPost,
  saveSectionContent,
  saveWhyPoint,
} from "@/features/cms/admin-actions";
import type { SectionContent, SectionRow } from "@/types/content";

const LIMITS: Partial<Record<SectionRow["key"], { min: number; max: number; label: string }>> = {
  ROOMS_GRID: { min: 1, max: 12, label: "Rooms to show" },
  GALLERY: { min: 1, max: 6, label: "Photos to show" },
  FAQ: { min: 1, max: 20, label: "Questions to show" },
};

/** Heading/intro form for one homepage section, plus list editors for sections that have items. */
export function SectionEditor({ section }: { section: SectionRow }) {
  const c = section.content as SectionContent[keyof SectionContent];
  const limit = LIMITS[section.key];
  return (
    <div className="grid gap-8">
      <ActionForm action={saveSectionContent} className="grid gap-5">
        <input type="hidden" name="key" value={section.key} />
        <BilingualField name="title" label="Heading" defaultValue={c && "title" in c ? c.title : undefined} maxLength={160} />
        {section.key === "CTA" ? (
          <BilingualField
            name="body"
            label="Text"
            multiline
            rows={2}
            defaultValue={(c as SectionContent["CTA"]).body}
            maxLength={400}
          />
        ) : (
          <BilingualField
            name="intro"
            label="Introduction"
            multiline
            rows={2}
            required={false}
            defaultValue={"intro" in c ? c.intro : undefined}
            maxLength={600}
          />
        )}
        {limit ? (
          <FormField name="limit" label={limit.label} hint={`From ${limit.min} to ${limit.max}.`} className="max-w-48">
            <Input
              type="number"
              inputMode="numeric"
              min={limit.min}
              max={limit.max}
              required
              defaultValue={"limit" in c ? c.limit : limit.min}
            />
          </FormField>
        ) : null}
        <SubmitButton className="w-fit">Save section</SubmitButton>
      </ActionForm>

      {section.key === "WHY_CHOOSE_US" ? <WhyPoints points={(c as SectionContent["WHY_CHOOSE_US"]).points} /> : null}
      {section.key === "INSTAGRAM_FEED" ? <InstagramPosts posts={(c as SectionContent["INSTAGRAM_FEED"]).posts} /> : null}
    </div>
  );
}

function WhyPoints({ points }: { points: SectionContent["WHY_CHOOSE_US"]["points"] }) {
  return (
    <div className="border-line grid gap-4 border-t pt-6">
      <h3 className="font-sans text-base font-semibold">Points ({points.length})</h3>
      {points.length === 0 ? <p className="text-muted text-sm">No points yet. Add the first one below.</p> : null}
      <ol className="grid gap-3">
        {points.map((p, i) => (
          <li key={p.id} className="border-line rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-medium">
                <span className="theme-dark bg-bg text-accent grid size-9 place-items-center rounded-lg">
                  <AmenityIcon name={p.icon} className="size-4" />
                </span>
                {p.title.en}
              </p>
              <div className="flex items-center gap-1">
                <MoveButtons action={moveWhyPoint} fields={{ id: p.id }} first={i === 0} last={i === points.length - 1} label={p.title.en} />
                <ConfirmButton
                  action={deleteWhyPoint}
                  fields={{ id: p.id }}
                  title="Remove this point?"
                  body={`“${p.title.en}” will no longer show on the homepage.`}
                  confirmLabel="Remove"
                  size="icon"
                  variant="ghost"
                  className="text-danger size-9"
                  aria-label={`Remove ${p.title.en}`}
                >
                  <Trash2 aria-hidden />
                </ConfirmButton>
              </div>
            </div>
            <details className="mt-2">
              <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">Edit point</summary>
              <ActionForm action={saveWhyPoint} className="mt-4 grid gap-4">
                <input type="hidden" name="id" value={p.id} />
                <IconPicker defaultValue={p.icon} />
                <BilingualField name="title" label="Title" defaultValue={p.title} maxLength={120} />
                <BilingualField name="body" label="Text" multiline rows={2} defaultValue={p.body} maxLength={400} />
                <SubmitButton size="sm" className="w-fit">
                  Save point
                </SubmitButton>
              </ActionForm>
            </details>
          </li>
        ))}
      </ol>
      {points.length < 8 ? (
        <details className="border-line-strong rounded-xl border border-dashed p-4">
          <summary className="w-fit cursor-pointer text-sm font-medium">Add a point</summary>
          <ActionForm action={saveWhyPoint} resetOnSuccess className="mt-4 grid gap-4">
            <IconPicker />
            <BilingualField name="title" label="Title" maxLength={120} />
            <BilingualField name="body" label="Text" multiline rows={2} maxLength={400} />
            <SubmitButton size="sm" className="w-fit">
              Add point
            </SubmitButton>
          </ActionForm>
        </details>
      ) : null}
    </div>
  );
}

function InstagramPosts({ posts }: { posts: SectionContent["INSTAGRAM_FEED"]["posts"] }) {
  return (
    <div className="border-line grid gap-4 border-t pt-6">
      <div>
        <h3 className="font-sans text-base font-semibold">Posts ({posts.length})</h3>
        <p className="text-muted text-sm">
          Add a photo from one of the hotel&apos;s Instagram posts and link it to that post. Use only the hotel&apos;s own posts.
        </p>
      </div>
      {posts.length ? (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((p, i) => (
            <li key={p.id} className="border-line grid content-start gap-3 rounded-xl border p-3">
              <div className="bg-surface-3 relative aspect-square overflow-hidden rounded-lg">
                <Image src={p.imageUrl} alt={p.alt} fill sizes="240px" className="object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <MoveButtons action={moveInstagramPost} fields={{ id: p.id }} first={i === 0} last={i === posts.length - 1} label={p.alt} />
                <ConfirmButton
                  action={deleteInstagramPost}
                  fields={{ id: p.id }}
                  title="Remove this post?"
                  confirmLabel="Remove"
                  size="icon"
                  variant="ghost"
                  className="text-danger size-9"
                  aria-label={`Remove post: ${p.alt}`}
                >
                  <Trash2 aria-hidden />
                </ConfirmButton>
              </div>
              <details>
                <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">Edit post</summary>
                <InstagramPostForm post={p} />
              </details>
            </li>
          ))}
        </ol>
      ) : null}
      {posts.length < 12 ? (
        <details className="border-line-strong rounded-xl border border-dashed p-4">
          <summary className="w-fit cursor-pointer text-sm font-medium">Add a post</summary>
          <InstagramPostForm />
        </details>
      ) : null}
    </div>
  );
}

function InstagramPostForm({ post }: { post?: SectionContent["INSTAGRAM_FEED"]["posts"][number] }) {
  return (
    <ActionForm action={saveInstagramPost} resetOnSuccess={!post} className="mt-4 grid gap-4">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <MediaPickerField name="imageUrl" label="Photo" folder="general" aspect="aspect-square max-w-56" defaultValue={post?.imageUrl} />
      <FormField name="link" label="Link to the Instagram post">
        <Input type="url" required placeholder="https://www.instagram.com/p/…" defaultValue={post?.link} />
      </FormField>
      <FormField name="alt" label="Describe the photo" hint="Read aloud by screen readers.">
        <Input required maxLength={200} defaultValue={post?.alt} />
      </FormField>
      <SubmitButton size="sm" className="w-fit">
        {post ? "Save post" : "Add post"}
      </SubmitButton>
    </ActionForm>
  );
}
