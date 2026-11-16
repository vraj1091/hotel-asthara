import { OfferForm } from "@/components/admin/offers/offer-forms";
import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { couponLabel } from "@/features/offers/status";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";

export const metadata = { title: "New offer" };

export default async function NewOfferPage() {
  await requirePage("offers:write");
  const coupons = await db.coupon.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" } });
  return (
    <>
      <AdminPageHeader title="New offer" back={{ href: "/admin/offers", label: "Offers" }} />
      <AdminCard>
        <OfferForm
          coupons={coupons.map((c) => ({ id: c.id, code: c.code, label: couponLabel(c) }))}
          offer={{ title: "", titleHi: "", description: "", descriptionHi: "", imageUrl: "", couponId: "", startsAt: "", endsAt: "", active: true }}
        />
      </AdminCard>
    </>
  );
}
