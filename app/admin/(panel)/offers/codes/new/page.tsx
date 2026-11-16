import { CouponForm } from "@/components/admin/offers/offer-forms";
import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { requirePage } from "@/lib/session";

export const metadata = { title: "New promo code" };

export default async function NewCouponPage() {
  await requirePage("offers:write");
  return (
    <>
      <AdminPageHeader title="New promo code" back={{ href: "/admin/offers/codes", label: "Promo codes" }} />
      <AdminCard>
        <CouponForm
          coupon={{
            code: "",
            kind: "PERCENT",
            value: "",
            maxDiscount: "",
            minNights: "1",
            minAmount: "",
            usageLimit: "",
            startsAt: "",
            endsAt: "",
            active: true,
          }}
        />
      </AdminCard>
    </>
  );
}
