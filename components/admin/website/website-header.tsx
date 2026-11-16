import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { ActionButton } from "@/components/admin/forms";
import { AdminPageHeader, LinkTabs } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action";

export const WEBSITE_TABS = [
  { key: "home", label: "Homepage", href: "/admin/website" },
  { key: "hero", label: "Hero", href: "/admin/website/hero" },
  { key: "about", label: "About", href: "/admin/website/about" },
  { key: "amenities", label: "Amenities", href: "/admin/website/amenities" },
  { key: "gallery", label: "Gallery", href: "/admin/website/gallery" },
  { key: "location", label: "Location", href: "/admin/website/location" },
  { key: "contact", label: "Contact & hours", href: "/admin/website/contact" },
  { key: "policies", label: "Policies", href: "/admin/website/policies" },
  { key: "faqs", label: "FAQs", href: "/admin/website/faqs" },
  { key: "seo", label: "SEO", href: "/admin/website/seo" },
  { key: "reviews", label: "Reviews", href: "/admin/website/reviews" },
] as const;

export type WebsiteTab = (typeof WEBSITE_TABS)[number]["key"];

/** Page title, "View on site" link and the tab bar shared by every Website editor page. */
export function WebsiteHeader({
  current,
  description,
  viewHref = "/",
}: {
  current: WebsiteTab;
  description: React.ReactNode;
  viewHref?: string;
}) {
  return (
    <>
      <AdminPageHeader
        title="Website editor"
        description={description}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={viewHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              View on site
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        }
      />
      <LinkTabs tabs={WEBSITE_TABS.map((t) => ({ ...t }))} current={current} />
    </>
  );
}

/** Up / down buttons for reordering an item through a server action. */
export function MoveButtons({
  action,
  fields,
  first,
  last,
  label,
}: {
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  fields: Record<string, string>;
  first: boolean;
  last: boolean;
  label: string;
}) {
  return (
    <div className="flex gap-1">
      <ActionButton
        action={action}
        fields={{ ...fields, dir: "up" }}
        size="icon"
        variant="ghost"
        className="size-9"
        disabled={first}
        aria-label={`Move ${label} up`}
        success="Moved up."
      >
        <ArrowUp aria-hidden />
      </ActionButton>
      <ActionButton
        action={action}
        fields={{ ...fields, dir: "down" }}
        size="icon"
        variant="ghost"
        className="size-9"
        disabled={last}
        aria-label={`Move ${label} down`}
        success="Moved down."
      >
        <ArrowDown aria-hidden />
      </ActionButton>
    </div>
  );
}
