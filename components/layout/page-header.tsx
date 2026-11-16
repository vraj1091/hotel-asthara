import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

export async function PageHeader({
  title,
  intro,
  crumbs = [],
}: {
  title: string;
  intro?: string;
  crumbs?: { name: string; href?: string }[];
}) {
  const t = await getTranslations("nav");
  return (
    <header className="border-line bg-surface-2 border-b">
      <div className="container-page py-14 md:py-20">
        <nav aria-label="Breadcrumb" className="text-muted mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="link-underline">
                {t("home")}
              </Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.name} className="flex items-center gap-1.5">
                <ChevronRight className="size-3.5" aria-hidden />
                {c.href ? (
                  <Link href={c.href} className="link-underline">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page">{c.name}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <Reveal>
          <h1 className="text-h1 max-w-3xl">{title}</h1>
          {intro ? <p className="text-muted mt-4 max-w-[60ch] text-lg">{intro}</p> : null}
          <hr className="hairline-solid mt-7 w-16" />
        </Reveal>
      </div>
    </header>
  );
}
