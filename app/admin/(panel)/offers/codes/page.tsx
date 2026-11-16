import Link from "next/link";
import { Plus, TicketPercent } from "lucide-react";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { OffersTabs } from "@/components/admin/offers/tabs";
import { AdminCard, AdminPageHeader, EmptyState, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteCoupon, resetCouponCount, setCouponActive } from "@/features/offers/actions";
import { COUPON_STATUS_UI, couponLabel, couponStatus } from "@/features/offers/status";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Promo codes" };

export default async function CouponsPage() {
  await requirePage("offers:write");
  const coupons = await db.coupon.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { offers: { where: { deletedAt: null }, select: { title: true } } },
  });
  return (
    <>
      <AdminPageHeader
        title="Offers & promo codes"
        description="Promo codes give a discount on room charges before GST. Each use is counted when a booking is made and returned if it is cancelled."
        actions={
          <Button asChild>
            <Link href="/admin/offers/codes/new">
              <Plus aria-hidden /> New promo code
            </Link>
          </Button>
        }
      />
      <OffersTabs current="codes" />
      <AdminCard>
        {coupons.length === 0 ? (
          <EmptyState
            icon={<TicketPercent />}
            title="No promo codes yet"
            body="Create a code, then link it to an offer so guests can find it."
            action={
              <Button asChild>
                <Link href="/admin/offers/codes/new">Create a promo code</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Rules</Th>
                <Th className="text-right">Used</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const status = COUPON_STATUS_UI[couponStatus(c)];
                return (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/admin/offers/codes/${c.id}`} className="link-underline font-mono font-medium">
                        {c.code}
                      </Link>
                      {c.offers.length ? (
                        <p className="text-muted text-xs">Offer: {c.offers.map((o) => o.title).join(", ")}</p>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap">{couponLabel(c)}</Td>
                    <Td className="text-muted text-xs">
                      {c.minNights > 1 ? `Min ${c.minNights} nights. ` : ""}
                      {c.minAmountPaise ? `Min ${formatINR(c.minAmountPaise)}. ` : ""}
                      {c.endsAt ? `Ends ${formatDateTime(c.endsAt)}.` : "No end date."}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {c.usedCount}
                      {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                    </Td>
                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-1">
                        <ActionButton action={setCouponActive} fields={{ id: c.id, active: c.active ? "0" : "1" }} size="sm" variant="outline">
                          {c.active ? "Deactivate" : "Activate"}
                        </ActionButton>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/offers/codes/${c.id}`}>Edit</Link>
                        </Button>
                        {c.usedCount > 0 ? (
                          <ConfirmButton
                            action={resetCouponCount}
                            fields={{ id: c.id }}
                            title={`Reset the usage count of ${c.code}?`}
                            body="The count goes back to 0, so the code can be used up to its limit again."
                            confirmLabel="Reset count"
                            danger={false}
                            size="sm"
                            variant="ghost"
                          >
                            Reset count
                          </ConfirmButton>
                        ) : null}
                        <ConfirmButton
                          action={deleteCoupon}
                          fields={{ id: c.id }}
                          title={`Delete ${c.code}?`}
                          body="Guests can no longer use it. Past bookings keep their discount."
                          confirmLabel="Delete code"
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
