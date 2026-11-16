import Link from "next/link";
import { MessageSquareQuote, Star, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, Checkbox, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { AdminCard, EmptyState } from "@/components/admin/ui";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { deleteTestimonial, saveRating, saveTestimonial, setTestimonialFlag } from "@/features/cms/admin-reviews";
import { loadSetting } from "@/features/cms/admin-shared";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Reviews | Website editor" };

type Review = Awaited<ReturnType<typeof db.testimonial.findMany>>[number];
const FILTERS = [
  { key: "", label: "All" },
  { key: "approved", label: "On the website" },
  { key: "pending", label: "Not approved" },
] as const;

export default async function ReviewsEditorPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePage("content:write");
  const { show } = await searchParams;
  const filter = show === "approved" || show === "pending" ? show : "";
  const [rating, reviews, counts] = await Promise.all([
    loadSetting("rating"),
    db.testimonial.findMany({
      where: { deletedAt: null, ...(filter ? { approved: filter === "approved" } : {}) },
      orderBy: [{ approved: "asc" }, { featured: "desc" }, { createdAt: "desc" }],
    }),
    db.testimonial.groupBy({ by: ["approved"], where: { deletedAt: null }, _count: true }),
  ]);
  const count = (approved: boolean) => counts.find((c) => c.approved === approved)?._count ?? 0;

  return (
    <>
      <WebsiteHeader
        current="reviews"
        viewHref="/#reviews"
        description="Guest reviews shown on the homepage, and the overall rating. Only approved reviews are public; the section is hidden while there are none."
      />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-6">
          <AdminCard title="Guest reviews">
            <div className="mb-5 flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const n = f.key === "" ? count(true) + count(false) : count(f.key === "approved");
                const active = filter === f.key;
                return (
                  <Link
                    key={f.key}
                    href={f.key ? `/admin/website/reviews?show=${f.key}` : "/admin/website/reviews"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm",
                      active ? "bg-ink text-bg" : "border-line-strong hover:bg-surface-2 border",
                    )}
                  >
                    {f.label} <span className="tabular-nums opacity-70">{n}</span>
                  </Link>
                );
              })}
            </div>
            {reviews.length === 0 ? (
              <EmptyState
                icon={<MessageSquareQuote />}
                title={filter ? "No reviews in this list" : "No reviews yet"}
                body="Copy real reviews guests have left, for example on Google, and add them here with the source."
              />
            ) : (
              <ul className="grid gap-3">
                {reviews.map((r) => (
                  <ReviewItem key={r.id} review={r} />
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
        <div className="grid content-start gap-6">
          <AdminCard title="Add a review" description="Only add genuine reviews from real guests.">
            <ReviewForm />
          </AdminCard>
          <AdminCard
            title="Overall rating"
            description="Shown next to the reviews and in the hero, and sent to search engines. Enter only real ratings from a public source. Leave the rating empty to hide it."
          >
            <ActionForm action={saveRating} className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField name="value" label="Rating out of 5" optional>
                  <Input type="number" inputMode="decimal" min={1} max={5} step={0.1} defaultValue={rating.value ?? ""} />
                </FormField>
                <FormField name="count" label="Number of reviews" optional>
                  <Input type="number" inputMode="numeric" min={1} step={1} defaultValue={rating.count ?? ""} />
                </FormField>
              </div>
              <FormField name="source" label="Source" optional hint="e.g. Google">
                <Input maxLength={40} defaultValue={rating.source} />
              </FormField>
              <FormField name="sourceUrl" label="Link to the reviews" optional>
                <Input type="url" maxLength={500} placeholder="https://…" defaultValue={rating.sourceUrl} />
              </FormField>
              <SubmitButton size="sm" className="w-fit">
                Save rating
              </SubmitButton>
            </ActionForm>
          </AdminCard>
        </div>
      </div>
    </>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={i < n ? "fill-accent text-accent size-4" : "text-line-strong size-4"} aria-hidden />
      ))}
    </span>
  );
}

function ReviewItem({ review: r }: { review: Review }) {
  return (
    <li className="border-line rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Stars n={r.rating} />
            {r.approved ? <Badge tone="success">On the website</Badge> : <Badge tone="warning">Not approved</Badge>}
            {r.featured ? <Badge tone="gold">Featured</Badge> : null}
          </div>
          <p className="mt-2 line-clamp-3">{r.body}</p>
          <p className="text-muted mt-1 text-sm">
            {r.name}
            {r.location ? `, ${r.location}` : ""}
            {r.source ? ` · ${r.source}` : ""} · added {formatDateTime(r.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ActionButton
            action={setTestimonialFlag}
            fields={{ id: r.id, flag: "approved", value: r.approved ? "0" : "1" }}
            size="sm"
            variant={r.approved ? "outline" : "primary"}
          >
            {r.approved ? "Unpublish" : "Approve"}
          </ActionButton>
          <ActionButton
            action={setTestimonialFlag}
            fields={{ id: r.id, flag: "featured", value: r.featured ? "0" : "1" }}
            size="sm"
            variant="ghost"
          >
            {r.featured ? "Unfeature" : "Feature"}
          </ActionButton>
          <ConfirmButton
            action={deleteTestimonial}
            fields={{ id: r.id }}
            title="Delete this review?"
            body={`The review by ${r.name} will be removed from the admin and the website.`}
            confirmLabel="Delete"
            size="icon"
            variant="ghost"
            className="text-danger size-9"
            aria-label={`Delete review by ${r.name}`}
          >
            <Trash2 aria-hidden />
          </ConfirmButton>
        </div>
      </div>
      <details className="mt-2">
        <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">Edit review</summary>
        <div className="mt-4">
          <ReviewForm review={r} />
        </div>
      </details>
    </li>
  );
}

function ReviewForm({ review }: { review?: Review }) {
  return (
    <ActionForm action={saveTestimonial} resetOnSuccess={!review} className="grid gap-4">
      {review ? <input type="hidden" name="id" value={review.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="Guest name">
          <Input required minLength={2} maxLength={80} defaultValue={review?.name} />
        </FormField>
        <FormField name="location" label="From" optional hint="e.g. Delhi">
          <Input maxLength={80} defaultValue={review?.location ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="rating" label="Stars">
          <NativeSelect required defaultValue={String(review?.rating ?? 5)}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField name="source" label="Source" optional hint="e.g. Google, MakeMyTrip">
          <Input maxLength={60} defaultValue={review?.source ?? ""} />
        </FormField>
      </div>
      <FormField name="body" label="Review text" hint="Paste it exactly as the guest wrote it.">
        <Textarea rows={4} className="min-h-0" required minLength={10} maxLength={1000} defaultValue={review?.body} />
      </FormField>
      <div className="grid gap-3">
        <Checkbox name="approved" label="Show on the website" defaultChecked={review?.approved ?? true} />
        <Checkbox name="featured" label="Feature (shown first)" defaultChecked={review?.featured ?? false} />
      </div>
      <SubmitButton size="sm" className="w-fit">
        {review ? "Save review" : "Add review"}
      </SubmitButton>
    </ActionForm>
  );
}
