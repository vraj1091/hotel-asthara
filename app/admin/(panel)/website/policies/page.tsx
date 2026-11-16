import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ActionForm, BilingualField, SubmitButton } from "@/components/admin/forms";
import { AdminCard } from "@/components/admin/ui";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { savePolicy } from "@/features/cms/admin-actions";
import { POLICY_INFO } from "@/features/cms/admin-constants";
import { loadSetting } from "@/features/cms/admin-shared";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Policies | Website editor" };

const FORMAT_HINT = "Leave a blank line between paragraphs. Start lines with “- ” to make a bulleted list.";

export default async function PoliciesEditorPage() {
  const staff = await requirePage("content:write");
  const [policies, booking] = await Promise.all([loadSetting("policies"), loadSetting("booking")]);
  return (
    <>
      <WebsiteHeader
        current="policies"
        viewHref="/cancellation-policy"
        description="The policy pages linked from the footer and the booking flow, in English and Hindi."
      />
      <div className="grid gap-6">
        <AdminCard title="ID requirement" description="Shown on every room page, in confirmation emails and at checkout.">
          <ActionForm action={savePolicy} className="grid gap-5">
            <input type="hidden" name="key" value="idPolicy" />
            <BilingualField name="body" label="ID policy" multiline rows={4} defaultValue={policies.idPolicy} maxLength={2000} />
            <SubmitButton size="sm" className="w-fit">
              Save ID policy
            </SubmitButton>
          </ActionForm>
        </AdminCard>
        {(Object.keys(POLICY_INFO) as (keyof typeof POLICY_INFO)[]).map((key) => {
          const doc = policies[key];
          const info = POLICY_INFO[key];
          return (
            <AdminCard
              key={key}
              id={key}
              title={info.label}
              description={
                key === "cancellation" ? (
                  <>
                    Guests can currently cancel online up to <strong>{booking.freeCancelHours} hours</strong> before check-in
                    (Settings → Booking rules
                    {can(staff.permissions, "settings:manage") ? (
                      <>
                        ,{" "}
                        <Link href="/admin/settings" className="link-underline">
                          change
                        </Link>
                      </>
                    ) : null}
                    ). Keep this text in line with that.
                  </>
                ) : undefined
              }
              actions={
                <a href={info.path} target="_blank" rel="noopener noreferrer" className="link-underline flex items-center gap-1.5 text-sm">
                  <ExternalLink className="size-4" aria-hidden /> View page
                </a>
              }
            >
              <ActionForm action={savePolicy} className="grid gap-5">
                <input type="hidden" name="key" value={key} />
                <BilingualField name="title" label="Title" defaultValue={doc.title} maxLength={120} />
                <BilingualField name="body" label="Text" multiline rows={10} defaultValue={doc.body} maxLength={20000} hint={FORMAT_HINT} />
                <SubmitButton size="sm" className="w-fit">
                  Save {info.label.toLowerCase()}
                </SubmitButton>
              </ActionForm>
            </AdminCard>
          );
        })}
      </div>
    </>
  );
}
