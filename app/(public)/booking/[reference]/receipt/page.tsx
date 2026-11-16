import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintButton } from "@/components/invoice/print-button";
import { ensureInvoiceNumber } from "@/lib/booking-engine";
import { db } from "@/lib/db";
import { hasBookingAccess } from "@/lib/guest-access";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PRINTABLE = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

/**
 * The guest's printable copy. Before check-out it is a booking confirmation (no invoice number is used up, so
 * the GST invoice series has no gaps from stays that are later cancelled); after check-out it is the final
 * invoice or receipt, the same document the front desk prints.
 */
export default async function GuestReceiptPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference: rawRef } = await params;
  const reference = decodeURIComponent(rawRef).toUpperCase();
  if (!/^AST-\d{6}-[A-Z0-9]{4,6}$/.test(reference)) notFound();
  if (!(await hasBookingAccess(reference))) redirect(`/booking/manage?ref=${encodeURIComponent(reference)}`);

  const found = await db.booking.findUnique({
    where: { reference },
    select: { id: true, status: true, deletedAt: true, invoiceNumber: true },
  });
  if (!found || found.deletedAt) notFound();
  if (!PRINTABLE.includes(found.status)) redirect(`/booking/${reference}`);

  const invoiceNumber = found.status === "CHECKED_OUT" ? await ensureInvoiceNumber(found.id) : found.invoiceNumber;
  const [booking, settings, locale, t] = await Promise.all([
    db.booking.findUniqueOrThrow({
      where: { id: found.id },
      include: {
        guest: true,
        rooms: { include: { room: true, roomType: true }, orderBy: { room: { number: "asc" } } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    getSettings(),
    getLocale(),
    getTranslations("manage"),
  ]);

  return (
    <section className="bg-surface-2 py-8 md:py-12 print:bg-white print:py-0">
      <h1 className="sr-only">{t("receiptTitle")}</h1>
      <div className="container-page mb-4 flex max-w-[calc(210mm+2rem)] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/booking/${reference}`} className="text-muted hover:text-ink flex items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" aria-hidden /> {t("backToBooking")}
        </Link>
        <PrintButton label={t("printOrSave")} />
      </div>
      {locale === "hi" ? (
        <p className="text-muted container-page mb-4 max-w-[calc(210mm+2rem)] text-sm print:hidden" lang="hi">
          {t("receiptLanguageNote")}
        </p>
      ) : null}
      <div lang="en" className="card mx-auto max-w-[210mm] overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <InvoiceDocument booking={booking} settings={settings} invoiceNumber={invoiceNumber} />
      </div>
    </section>
  );
}
