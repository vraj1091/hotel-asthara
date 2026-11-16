"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavLinks } from "@/components/layout/nav-links";

export function MobileMenu({ hotelName }: { hotelName: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("menu")} className="lg:hidden">
          <Menu className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={t("closeMenu")}
        className="theme-dark top-0 right-0 left-auto h-dvh max-w-xs translate-x-0 translate-y-0 rounded-none rounded-l-3xl p-8"
      >
        <DialogTitle className="font-heading text-2xl">{hotelName}</DialogTitle>
        <hr className="hairline mt-4" />
        <nav aria-label="Main" className="mt-8 grid gap-5 text-xl">
          <Link href="/" onClick={() => setOpen(false)} className="font-heading">
            {t("home")}
          </Link>
          <NavLinks className="font-heading text-xl" onNavigate={() => setOpen(false)} />
          <Link href="/booking/manage" onClick={() => setOpen(false)} className="font-heading text-muted text-lg">
            {t("manageBooking")}
          </Link>
        </nav>
        <div className="mt-10 grid gap-3">
          <Button asChild size="lg">
            <Link href="/rooms" onClick={() => setOpen(false)}>
              {t("bookNow")}
            </Link>
          </Button>
          <LanguageSwitcher className="justify-center" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
