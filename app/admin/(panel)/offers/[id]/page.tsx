import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ConfirmButton } from "@/components/admin/forms";
import { OfferForm } from "@/components/admin/offers/offer-forms";
import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteOffer } from "@/features/offers/actions";
import { couponLabel, istDay, OFFER_STATUS_UI, offerStatus } from "@/features/offers/status";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Edit offer" };

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("offers:write");
  const { id } = await params;
  const [offer, coupons] = await Promise.all([
    db.offer.findFirst({ where: { id, deletedAt: null } }),
    db.coupon.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" } }),
  ]);
  if (!offer) notFound();
  const status = OFFER_STATUS_UI[offerStatus(offer)];
  return (
    <>
      <AdminPageHeader
        title={offer.title}
        back={{ href: "/admin/offers", label: "Offers" }}
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link href="/offers" target="_blank">
                <ExternalLink aria-hidden /> View offers page
              </Link>
            </Button>
            <ConfirmButton
              action={deleteOffer}
              fields={{ id: offer.id, redirect: "1" }}
              title={`Delete “${offer.title}”?`}
              body="It is removed from the website."
              confirmLabel="Delete offer"
              size="sm"
              variant="ghost"
              className="text-danger"
            >
              Delete
            </ConfirmButton>
          </>
        }
      />
      <AdminCard>
        <OfferForm
          coupons={coupons.map((c) => ({ id: c.id, code: c.code, label: couponLabel(c) }))}
          offer={{
            id: offer.id,
            title: offer.title,
            titleHi: offer.titleHi ?? "",
            description: offer.description,
            descriptionHi: offer.descriptionHi ?? "",
            imageUrl: offer.imageUrl ?? "",
            couponId: offer.couponId ?? "",
            startsAt: istDay(offer.startsAt),
            endsAt: istDay(offer.endsAt),
            active: offer.active,
          }}
        />
      </AdminCard>
    </>
  );
}
