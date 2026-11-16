import { LinkTabs } from "@/components/admin/ui";

export function OffersTabs({ current }: { current: "offers" | "codes" }) {
  return (
    <LinkTabs
      current={current}
      tabs={[
        { key: "offers", href: "/admin/offers", label: "Offers" },
        { key: "codes", href: "/admin/offers/codes", label: "Promo codes" },
      ]}
    />
  );
}
