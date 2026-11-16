"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BedDouble,
  CalendarCheck2,
  CalendarRange,
  ExternalLink,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Settings,
  Tag,
  UserCog,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AdminNavItem } from "@/components/admin/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  bookings: CalendarCheck2,
  calendar: CalendarRange,
  guests: Users,
  enquiries: Inbox,
  rooms: BedDouble,
  offers: Tag,
  website: PanelsTopLeft,
  media: Images,
  staff: UserCog,
  settings: Settings,
  activity: History,
};

type Props = {
  hotelName: string;
  staff: { name: string; roleName: string };
  nav: AdminNavItem[];
  badges: Partial<Record<NonNullable<AdminNavItem["badge"]>, number>>;
  signOut: () => Promise<void>;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string, all: AdminNavItem[]) {
  if (href === "/admin") return pathname === "/admin";
  if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
  // A more specific item (e.g. /admin/bookings/calendar) wins over its parent.
  return !all.some(
    (o) => o.href !== href && o.href.startsWith(href) && (pathname === o.href || pathname.startsWith(`${o.href}/`)),
  );
}

function NavList({ nav, badges, onNavigate }: Pick<Props, "nav" | "badges"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = [...new Set(nav.map((n) => n.group))];
  return (
    <nav aria-label="Admin" className="grid gap-6">
      {groups.map((group) => (
        <div key={group} className="grid gap-1">
          <p className="text-muted px-3 text-[0.7rem] font-semibold tracking-[0.12em] uppercase">{group}</p>
          {nav
            .filter((n) => n.group === group)
            .map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(pathname, item.href, nav);
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.94rem] transition-colors",
                    active
                      ? "bg-accent text-on-accent font-medium"
                      : "text-ink/85 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  <Icon className="size-[1.1rem] shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count ? (
                    <span
                      className={cn(
                        "min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums",
                        active ? "bg-on-accent text-accent" : "bg-accent text-on-accent",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> need attention</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ staff, signOut }: Pick<Props, "staff" | "signOut">) {
  return (
    <div className="border-line grid gap-1 border-t pt-4">
      <Link
        href="/admin/account"
        className="hover:bg-surface-3 flex items-center gap-3 rounded-xl px-3 py-2"
      >
        <span className="bg-surface-3 grid size-9 shrink-0 place-items-center rounded-full">
          <UserRound className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{staff.name}</span>
          <span className="text-muted block truncate text-xs">{staff.roleName}</span>
        </span>
      </Link>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink/85 hover:bg-surface-3 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm"
      >
        <ExternalLink className="size-4" aria-hidden />
        View website
      </a>
      <form action={signOut}>
        <button
          type="submit"
          className="text-ink/85 hover:bg-surface-3 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}

/** Admin layout: fixed navy sidebar on desktop, slide-in drawer on phones and tablets. */
export function AdminShell({ hotelName, staff, nav, badges, signOut, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5 px-3">
      <svg viewBox="0 0 120 150" className="text-accent h-8 w-auto" fill="none" aria-hidden>
        <path d="M12 148V62C12 30 33 8 60 8s48 22 48 54v86" stroke="currentColor" strokeWidth="9" />
        <path d="M40 148V70c0-14 9-26 20-26s20 12 20 26v78" stroke="currentColor" strokeWidth="9" opacity="0.6" />
      </svg>
      <span className="leading-tight">
        <span className="font-heading block text-lg">{hotelName}</span>
        <span className="text-muted block text-xs">Admin</span>
      </span>
    </Link>
  );

  return (
    <div className="bg-surface-2 min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#admin-main"
        className="focus:bg-accent focus:text-on-accent sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="theme-dark sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto px-3 py-5 lg:flex">
        {brand}
        <div className="flex-1">
          <NavList nav={nav} badges={badges} />
        </div>
        <SidebarFooter staff={staff} signOut={signOut} />
      </aside>

      <div className="min-w-0">
        <header className="theme-dark border-line sticky top-0 z-30 flex h-14 items-center justify-between border-b px-3 lg:hidden">
          {brand}
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger
              aria-label="Open admin menu"
              className="hover:bg-surface-3 grid size-11 place-items-center rounded-full"
            >
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="bg-ink/50 fixed inset-0 z-40 backdrop-blur-sm" />
              <DialogPrimitive.Content className="theme-dark fixed inset-y-0 left-0 z-50 flex w-[min(19rem,88vw)] flex-col gap-6 overflow-y-auto px-3 py-4 shadow-lift outline-none">
                <div className="flex items-center justify-between">
                  {brand}
                  <DialogPrimitive.Close
                    aria-label="Close admin menu"
                    className="hover:bg-surface-3 grid size-11 place-items-center rounded-full"
                  >
                    <X className="size-5" />
                  </DialogPrimitive.Close>
                </div>
                <DialogPrimitive.Title className="sr-only">Admin menu</DialogPrimitive.Title>
                <div className="flex-1">
                  <NavList nav={nav} badges={badges} onNavigate={() => setOpen(false)} />
                </div>
                <SidebarFooter staff={staff} signOut={signOut} />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </header>
        <main id="admin-main" tabIndex={-1} className="mx-auto w-full max-w-[88rem] px-4 py-6 outline-none md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
