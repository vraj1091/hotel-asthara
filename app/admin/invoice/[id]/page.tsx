import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintButton } from "@/components/invoice/print-button";
import { ensureInvoiceNumber } from "@/lib/booking-engine";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("bookings:read");
  const { id } = await params;
  const exists = await db.booking.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, reference: true, invoiceNumber: true, payments: { select: { status: true } } },
  });
  if (!exists) notFound();
  // No invoice for a booking that never happened and took no money.
  if (["CANCELLED", "NO_SHOW"].includes(exists.status) && !exists.invoiceNumber && !exists.payments.some((p) => p.status === "PAID")) {
    return (
      <main className="bg-surface-2 grid min-h-dvh place-items-center p-6">
        <div className="card grid max-w-md gap-3 p-8 text-center">
          <h1 className="text-h3">No invoice for this booking</h1>
          <p className="text-muted">
            {exists.reference} was {exists.status === "CANCELLED" ? "cancelled" : "a no-show"} and no payment was taken, so there is nothing to invoice.
          </p>
          <Link href={`/admin/bookings/${id}`} className="link-underline mx-auto w-fit text-sm">
            Back to booking
          </Link>
        </div>
      </main>
    );
  }
  const invoiceNumber = await ensureInvoiceNumber(id);
  const [booking, settings] = await Promise.all([
    db.booking.findUniqueOrThrow({
      where: { id },
      include: {
        guest: true,
        rooms: { include: { room: true, roomType: true }, orderBy: { room: { number: "asc" } } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    getSettings(),
  ]);

  return (
    <main className="bg-surface-2 min-h-dvh py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href={`/admin/bookings/${id}`} className="text-muted hover:text-ink flex items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" aria-hidden /> Back to booking
        </Link>
        <PrintButton />
      </div>
      {!settings.gst.gstin ? (
        <p className="border-warning/40 bg-warning/10 mx-auto mb-4 max-w-[210mm] rounded-xl border px-4 py-3 text-sm print:hidden">
          No GSTIN is set, so this prints as a receipt. Add the GSTIN in Settings to issue GST tax invoices.
        </p>
      ) : null}
      <div className="card mx-auto max-w-[210mm] overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <InvoiceDocument booking={booking} settings={settings} invoiceNumber={invoiceNumber} />
      </div>
    </main>
  );
}
