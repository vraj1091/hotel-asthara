"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const [pending, start] = useTransition();
  const next = locale === "hi" ? "en" : "hi";
  return (
    <button
      type="button"
      onClick={() => start(() => setLocaleAction(next))}
      disabled={pending}
      lang={next}
      aria-label={`${t("language")}: ${next === "hi" ? "हिन्दी" : "English"}`}
      className={cn(
        "border-line-strong text-ink hover:bg-surface-2 inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-60",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {next === "hi" ? "हिन्दी" : "English"}
    </button>
  );
}
