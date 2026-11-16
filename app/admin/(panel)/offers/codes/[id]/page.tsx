import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/forms";
import { CouponForm } from "@/components/admin/offers/offer-forms";
import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { deleteCoupon } from "@/features/offers/actions";
import { COUPON_STATUS_UI, couponStatus, istDay } from "@/features/offers/status";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Edit promo code" };

const rupees = (paise: number | null) => (paise === null ? "" : String(paise / 100));

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("offers:write");
  const { id } = await params;
  const coupon = await db.coupon.findFirst({ where: { id, deletedAt: null } });
  if (!coupon) notFound();
  const status = COUPON_STATUS_UI[couponStatus(coupon)];
  return (
    <>
      <AdminPageHeader
        title={coupon.code}
        description={`Used ${coupon.usedCount} time${coupon.usedCount === 1 ? "" : "s"}${coupon.usageLimit !== null ? ` of ${coupon.usageLimit}` : ""}.`}
        back={{ href: "/admin/offers/codes", label: "Promo codes" }}
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <ConfirmButton
              action={deleteCoupon}
              fields={{ id: coupon.id, redirect: "1" }}
              title={`Delete ${coupon.code}?`}
              body="Guests can no longer use it. Past bookings keep their discount."
              confirmLabel="Delete code"
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
        <CouponForm
          coupon={{
            id: coupon.id,
            code: coupon.code,
            kind: coupon.kind,
            value: coupon.kind === "PERCENT" ? String(coupon.value) : rupees(coupon.value),
            maxDiscount: rupees(coupon.maxDiscountPaise),
            minNights: String(coupon.minNights),
            minAmount: coupon.minAmountPaise ? rupees(coupon.minAmountPaise) : "",
            usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
            startsAt: istDay(coupon.startsAt),
            endsAt: istDay(coupon.endsAt),
            active: coupon.active,
          }}
        />
      </AdminCard>
    </>
  );
}
