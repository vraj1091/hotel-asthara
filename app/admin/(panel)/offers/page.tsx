import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, Tag } from "lucide-react";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { OffersTabs } from "@/components/admin/offers/tabs";
import { AdminCard, AdminPageHeader, EmptyState, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteOffer, moveOffer, setOfferActive } from "@/features/offers/actions";
import { OFFER_STATUS_UI, offerStatus } from "@/features/offers/status";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Offers" };

export default async function OffersPage() {
  await requirePage("offers:write");
  const offers = await db.offer.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { coupon: { select: { code: true, deletedAt: true } } },
  });
  return (
    <>
      <AdminPageHeader
        title="Offers & promo codes"
        description="Offers appear on the website's Offers page and the homepage. Link a promo code so guests get the discount at checkout."
        actions={
          <Button asChild>
            <Link href="/admin/offers/new">
              <Plus aria-hidden /> New offer
            </Link>
          </Button>
        }
      />
      <OffersTabs current="offers" />
      <AdminCard>
        {offers.length === 0 ? (
          <EmptyState
            icon={<Tag />}
            title="No offers yet"
            body="Create an offer to promote direct bookings. Only live offers are shown on the website."
            action={
              <Button asChild>
                <Link href="/admin/offers/new">Create an offer</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Offer</Th>
                <Th>Promo code</Th>
                <Th>Shown</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o, i) => {
                const status = OFFER_STATUS_UI[offerStatus(o)];
                return (
                  <tr key={o.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="bg-surface-3 relative hidden size-12 shrink-0 overflow-hidden rounded-lg sm:block">
                          {o.imageUrl ? <Image src={o.imageUrl} alt="" fill sizes="48px" className="object-cover" /> : null}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/admin/offers/${o.id}`} className="link-underline font-medium">
                            {o.title}
                          </Link>
                          {o.titleHi ? <p className="text-muted text-xs" lang="hi">{o.titleHi}</p> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {o.coupon && !o.coupon.deletedAt ? (
                        <code className="bg-surface-3 rounded px-1.5 py-0.5 font-mono text-xs">{o.coupon.code}</code>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-muted text-xs whitespace-nowrap">
                      {o.startsAt ? `From ${formatDateTime(o.startsAt)}` : "From now"}
                      <br />
                      {o.endsAt ? `Until ${formatDateTime(o.endsAt)}` : "No end date"}
                    </Td>
                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-1">
                        <ActionButton action={moveOffer} fields={{ id: o.id, dir: "up" }} size="icon" variant="ghost" disabled={i === 0} aria-label={`Move ${o.title} up`} className="size-9">
                          <ArrowUp aria-hidden />
                        </ActionButton>
                        <ActionButton action={moveOffer} fields={{ id: o.id, dir: "down" }} size="icon" variant="ghost" disabled={i === offers.length - 1} aria-label={`Move ${o.title} down`} className="size-9">
                          <ArrowDown aria-hidden />
                        </ActionButton>
                        <ActionButton action={setOfferActive} fields={{ id: o.id, active: o.active ? "0" : "1" }} size="sm" variant="outline">
                          {o.active ? "Deactivate" : "Activate"}
                        </ActionButton>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/offers/${o.id}`}>Edit</Link>
                        </Button>
                        <ConfirmButton
                          action={deleteOffer}
                          fields={{ id: o.id }}
                          title={`Delete “${o.title}”?`}
                          body="It is removed from the website. Its promo code keeps working until you deactivate the code."
                          confirmLabel="Delete offer"
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                        >
                          Delete
                        </ConfirmButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </AdminCard>
    </>
  );
}
