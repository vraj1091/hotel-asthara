import { HelpCircle, Trash2 } from "lucide-react";
import { ActionForm, BilingualField, ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { AdminCard, EmptyState } from "@/components/admin/ui";
import { MoveButtons, WebsiteHeader } from "@/components/admin/website/website-header";
import { deleteFaq, moveFaq, saveFaq } from "@/features/cms/admin-actions";
import { loadSection, loadSetting } from "@/features/cms/admin-shared";
import { requirePage } from "@/lib/session";
import type { Faq } from "@/types/content";

export const metadata = { title: "FAQs | Website editor" };

export default async function FaqsEditorPage() {
  await requirePage("content:write");
  const [faqs, section] = await Promise.all([loadSetting("faqs"), loadSection("FAQ")]);
  return (
    <>
      <WebsiteHeader
        current="faqs"
        viewHref="/faq"
        description={`Questions on the FAQ page. The homepage shows the first ${section.limit} (change that on the Homepage tab). They are also sent to search engines as FAQ data.`}
      />
      <AdminCard title={`Questions (${faqs.length})`}>
        {faqs.length === 0 ? <EmptyState icon={<HelpCircle />} title="No questions yet" body="Add the questions guests ask most often." /> : null}
        <ol className="grid gap-3">
          {faqs.map((f, i) => (
            <li key={f.id} className="border-line rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="text-muted mr-2 tabular-nums">{i + 1}.</span>
                    {f.q.en}
                  </p>
                  {f.q.hi ? (
                    <p className="text-muted text-sm" lang="hi">
                      {f.q.hi}
                    </p>
                  ) : (
                    <p className="text-warning text-sm">No Hindi translation yet – the English text is shown.</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <MoveButtons action={moveFaq} fields={{ id: f.id }} first={i === 0} last={i === faqs.length - 1} label={`question ${i + 1}`} />
                  <ConfirmButton
                    action={deleteFaq}
                    fields={{ id: f.id }}
                    title="Delete this question?"
                    body={`“${f.q.en}”`}
                    confirmLabel="Delete"
                    size="icon"
                    variant="ghost"
                    className="text-danger size-9"
                    aria-label={`Delete question ${i + 1}`}
                  >
                    <Trash2 aria-hidden />
                  </ConfirmButton>
                </div>
              </div>
              <details className="mt-2">
                <summary className="text-muted hover:text-ink w-fit cursor-pointer text-sm">Edit question and answer</summary>
                <FaqForm faq={f} />
              </details>
            </li>
          ))}
        </ol>
        {faqs.length < 40 ? (
          <details className="border-line-strong mt-4 rounded-xl border border-dashed p-4" open={faqs.length === 0}>
            <summary className="w-fit cursor-pointer text-sm font-medium">Add a question</summary>
            <FaqForm />
          </details>
        ) : null}
      </AdminCard>
    </>
  );
}

function FaqForm({ faq }: { faq?: Faq }) {
  return (
    <ActionForm action={saveFaq} resetOnSuccess={!faq} className="mt-4 grid gap-4">
      {faq ? <input type="hidden" name="id" value={faq.id} /> : null}
      <BilingualField name="q" label="Question" defaultValue={faq?.q} maxLength={300} />
      <BilingualField name="a" label="Answer" multiline rows={4} defaultValue={faq?.a} maxLength={2000} />
      <SubmitButton size="sm" className="w-fit">
        {faq ? "Save question" : "Add question"}
      </SubmitButton>
    </ActionForm>
  );
}
