"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page grid min-h-[50vh] place-items-center py-24 text-center">
      <div className="max-w-lg">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-muted mt-4 text-lg">{t("body")}</p>
        <Button size="lg" className="mt-8" onClick={reset}>
          {tc("retry")}
        </Button>
      </div>
    </div>
  );
}
