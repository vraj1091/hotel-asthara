"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { cn, formatINR } from "@/lib/utils";

export type ShowcaseRoom = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  meta: string[];
  ratePaise: number;
  cover: { url: string; alt: string } | null;
  tonight: number | null; // rooms free tonight; null when live data is unavailable
  amenities: { key: string; label: string; icon: string }[];
};

function TonightBadge({ free }: { free: number | null }) {
  const t = useTranslations("showcase");
  if (free === null) return null;
  return free > 0 ? (
    <Badge tone="gold" className="w-fit">
      {t("tonightLeft", { count: free })}
    </Badge>
  ) : (
    <Badge tone="neutral" className="w-fit">
      {t("tonightFull")}
    </Badge>
  );
}

/**
 * Home page room picker. Desktop: choose a room on the left (hover, click or arrow keys) and the stage on the right
 * cross-fades to it with tonight's live availability and rate. Phones: a swipeable, snap-scrolling row of cards.
 */
export function RoomShowcase({ rooms, initialId }: { rooms: ShowcaseRoom[]; initialId: string }) {
  const [value, setValue] = useState(initialId);
  const t = useTranslations("showcase");
  const tc = useTranslations("common");

  const price = (room: ShowcaseRoom, large = false) => (
    <p className="font-sans">
      <span className={cn("text-ink font-semibold tabular-nums", large ? "text-3xl" : "text-xl")}>
        {formatINR(room.ratePaise)}
      </span>
      <span className="text-muted text-sm">
        {" "}
        {tc("perNight")}, {tc("plusTax")}
      </span>
    </p>
  );

  return (
    <>
      <Tabs.Root
        value={value}
        onValueChange={setValue}
        orientation="vertical"
        className="hidden lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14"
      >
        <Tabs.List
          aria-label={t("pick")}
          className="border-line flex flex-col self-center border-b"
        >
          {rooms.map((room) => (
            <Tabs.Trigger
              key={room.id}
              value={room.id}
              onPointerEnter={(e) => e.pointerType === "mouse" && setValue(room.id)}
              className="group border-line relative border-t py-6 pl-7 text-left"
            >
              <span
                className="bg-accent absolute top-6 bottom-6 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-500 ease-out group-data-[state=active]:scale-y-100"
                aria-hidden
              />
              <span className="flex items-baseline justify-between gap-6">
                <span className="font-heading text-muted group-data-[state=active]:text-ink text-[2rem] leading-tight transition-colors duration-300">
                  {room.name}
                </span>
                <span className="text-muted shrink-0 text-sm tabular-nums">
                  {formatINR(room.ratePaise)}
                </span>
              </span>
              <span className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-data-[state=active]:grid-rows-[1fr]">
                <span className="overflow-hidden">
                  <span className="text-muted block max-w-[44ch] pt-2">{room.summary}</span>
                  <span className="text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {room.meta.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </span>
                </span>
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="relative min-h-[34rem]">
          {rooms.map((room) => {
            const active = room.id === value;
            return (
              <Tabs.Content
                key={room.id}
                value={room.id}
                forceMount
                inert={!active}
                className="absolute inset-0 transition-opacity duration-500 ease-out data-[state=inactive]:pointer-events-none data-[state=inactive]:opacity-0"
              >
                <article className="shadow-lift relative isolate flex h-full overflow-hidden rounded-[1.75rem]">
                  <Photo
                    src={room.cover?.url}
                    alt={room.cover?.alt || room.name}
                    sizes="(min-width: 1024px) 55vw, 100vw"
                    className={cn(
                      "absolute inset-0 -z-10 transition-transform duration-[1200ms] ease-out",
                      active ? "scale-100" : "scale-[1.06]",
                    )}
                  />
                  <div className="theme-dark from-bg via-bg/85 mt-auto w-full bg-transparent bg-gradient-to-t to-transparent p-8 pt-28">
                    <TonightBadge free={room.tonight} />
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
                      <div>
                        {price(room, true)}
                        <ul className="mt-4 flex gap-2">
                          {room.amenities.map((a) => (
                            <li
                              key={a.key}
                              title={a.label}
                              className="border-line text-ink grid size-10 place-items-center rounded-full border"
                            >
                              <AmenityIcon name={a.icon} className="size-[1.1rem]" />
                              <span className="sr-only">{a.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button asChild size="lg">
                        <Link href={`/rooms/${room.slug}`}>
                          {tc("viewDetails")}
                          <span className="sr-only">: {room.name}</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              </Tabs.Content>
            );
          })}
        </div>
      </Tabs.Root>

      <ul className="-mx-5 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-4 lg:hidden [&::-webkit-scrollbar]:hidden">
        {rooms.map((room) => (
          <li key={room.id} className="w-[84%] max-w-sm shrink-0 snap-center">
            <article className="card relative flex h-full flex-col overflow-hidden">
              <Photo
                src={room.cover?.url}
                alt={room.cover?.alt || room.name}
                sizes="85vw"
                className="aspect-[4/3]"
              />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <TonightBadge free={room.tonight} />
                <h3 className="text-h3">
                  <Link href={`/rooms/${room.slug}`} className="after:absolute after:inset-0">
                    {room.name}
                  </Link>
                </h3>
                <p className="text-muted">{room.summary}</p>
                <p className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {room.meta.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </p>
                <div className="mt-auto pt-2">{price(room)}</div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
