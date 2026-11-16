"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BookingBar, type BookingDefaults } from "@/components/sections/booking-bar";
import { NavLinks } from "@/components/layout/nav-links";
import { cn } from "@/lib/utils";

/**
 * Middle of the site header. On pages with a hero (the homepage), once the hero has scrolled away on large screens,
 * the nav links give way to the compact stay search. It lives inside the sticky header, so it never floats over
 * the page and never covers a heading – the header simply changes what it shows.
 */
export function HeaderCenter({
  defaults,
  maxRooms,
  maxNights,
}: {
  defaults: BookingDefaults;
  maxRooms: number;
  maxNights: number;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const wide = window.matchMedia("(min-width: 1024px)");
    if (!hero) {
      setSearch(false);
      return;
    }
    let past = false;
    const apply = () => setSearch(past && wide.matches);
    const io = new IntersectionObserver(
      ([entry]) => {
        past = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0;
        apply();
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" },
    );
    io.observe(hero);
    wide.addEventListener("change", apply);
    return () => {
      io.disconnect();
      wide.removeEventListener("change", apply);
    };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-header-search", search);
    return () => document.documentElement.removeAttribute("data-header-search");
  }, [search]);

  return (
    <div className="relative hidden min-w-0 flex-1 items-center justify-center lg:flex">
      <nav
        aria-label="Main"
        aria-hidden={search}
        inert={search}
        className={cn(
          "flex items-center gap-7 transition-[opacity,transform] duration-300 xl:gap-8",
          search ? "pointer-events-none -translate-y-2 opacity-0" : "opacity-100",
        )}
      >
        <NavLinks />
      </nav>
      <div
        aria-hidden={!search}
        inert={!search}
        className={cn(
          "absolute inset-x-0 top-1/2 mx-auto w-full max-w-[40rem] -translate-y-1/2 transition-[opacity,transform] duration-300",
          search ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0",
        )}
      >
        <BookingBar defaults={defaults} variant="header" maxRooms={maxRooms} maxNights={maxNights} />
      </div>
    </div>
  );
}
