import Image from "next/image";
import { getLocale } from "next-intl/server";
import { Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { tr } from "@/lib/settings";
import type { SectionContent, SiteSettings } from "@/types/content";

/** Instagram's API needs an approved app, so posts are curated in the admin (image + link). With none added, a follow card shows. */
export async function InstagramFeed({
  content,
  settings,
}: {
  content: SectionContent["INSTAGRAM_FEED"];
  settings: SiteSettings;
}) {
  const locale = await getLocale();
  const handle = settings.contact.instagram;
  if (!handle) return null;
  const url = `https://www.instagram.com/${handle}/`;
  const posts = content.posts.filter((p) => p.imageUrl).slice(0, 6);
  if (posts.length === 0) {
    // Nothing curated yet: a slim follow strip instead of an empty section.
    return (
      <section id="instagram" className="py-10">
        <div className="container-page border-line flex flex-wrap items-center justify-between gap-4 border-y py-6">
          <p className="font-heading text-xl">{tr(content.title, locale)}</p>
          <Button asChild variant="outline">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Instagram aria-hidden />@{handle}
            </a>
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section id="instagram" className="section-y">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
          <Button asChild variant="outline">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Instagram aria-hidden />@{handle}
            </a>
          </Button>
        </div>
        {posts.length ? (
          <Reveal className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {posts.map((p) => (
              <a
                key={p.id}
                href={p.link || url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-surface-3 relative block aspect-square overflow-hidden rounded-xl"
              >
                <Image
                  src={p.imageUrl}
                  alt={p.alt || `Post by @${handle}`}
                  fill
                  sizes="(min-width: 1024px) 16vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </a>
            ))}
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
