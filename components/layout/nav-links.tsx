"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/rooms", key: "rooms" },
  { href: "/gallery", key: "gallery" },
  { href: "/about", key: "about" },
  { href: "/nearby", key: "nearby" },
  { href: "/offers", key: "offers" },
  { href: "/contact", key: "contact" },
] as const;

export function NavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "link-underline text-ink/85 hover:text-ink py-1 text-[0.95rem] transition-colors",
              active && "text-ink [background-size:100%_1px]",
              className,
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </>
  );
}
