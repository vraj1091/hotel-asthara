import type { Prisma } from "@prisma/client";
import { rupeesInWords } from "@/components/invoice/amount-in-words";
import type { NightlyRate } from "@/lib/pricing";
import { formatDateTime, formatDay, formatINR } from "@/lib/utils";
import type { SiteSettings } from "@/types/content";

export type InvoiceBooking = Prisma.BookingGetPayload<{
  include: { guest: true; rooms: { include: { room: true; roomType: true } }; payments: true };
}>;

const METHOD: Record<string, string> = {
  RAZORPAY: "Online (Razorpay)",
  PAY_AT_HOTEL: "Pay at hotel",
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

type Line = { description: string; detail: string; qty: number; ratePaise: number; amountPaise: number };

function lines(booking: InvoiceBooking): Line[] {
  const out: Line[] = [];
  for (const r of booking.rooms) {
    const nights = ((r.nightlyRates as unknown as NightlyRate[]) ?? []).filter(Boolean);
    const label = `${r.roomType.name}, room ${r.room.number}`;
    const same = nights.length > 0 && nights.every((n) => n.ratePaise === nights[0]!.ratePaise);
    if (same || nights.length === 0) {
      const qty = nights.length || booking.nights;
      const rate = nights[0]?.ratePaise ?? Math.round(r.subtotalPaise / Math.max(1, qty));
      out.push({
        description: label,
        detail: `${formatDay(r.checkIn, "en-IN", { year: "numeric" })} to ${formatDay(r.checkOut, "en-IN", { year: "numeric" })}`,
        qty,
        ratePaise: rate,
        amountPaise: r.subtotalPaise,
      });
    } else {
      for (const n of nights)
        out.push({
          description: label,
          detail: `Night of ${formatDay(n.date, "en-IN", { year: "numeric" })}${n.rule ? ` (${n.rule})` : ""}`,
          qty: 1,
          ratePaise: n.ratePaise,
          amountPaise: n.ratePaise,
        });
    }
  }
  return out;
}

/** GST split by slab. Each night's slab comes from what was charged, then the discount is spread pro rata. */
function taxSlabs(booking: InvoiceBooking) {
  const bySlab = new Map<number, { taxable: number; tax: number }>();
  for (const r of booking.rooms) {
    const nights = ((r.nightlyRates as unknown as NightlyRate[]) ?? []).filter(Boolean);
    if (nights.length === 0) {
      const pct = r.subtotalPaise ? Math.round((r.taxPaise / r.subtotalPaise) * 100) : 0;
      const e = bySlab.get(pct) ?? { taxable: 0, tax: 0 };
      bySlab.set(pct, { taxable: e.taxable + r.subtotalPaise, tax: e.tax + r.taxPaise });
      continue;
    }
    for (const n of nights) {
      const pct = n.ratePaise ? Math.round((n.taxPaise / n.ratePaise) * 100) : 0;
      const e = bySlab.get(pct) ?? { taxable: 0, tax: 0 };
      bySlab.set(pct, { taxable: e.taxable + n.ratePaise, tax: e.tax + n.taxPaise });
    }
  }
  const gross = [...bySlab.values()].reduce((s, v) => s + v.taxable, 0);
  const ratio = gross ? (booking.subtotalPaise - booking.discountPaise) / gross : 1;
  const slabs = [...bySlab.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pct, v]) => ({ pct, taxable: Math.round(v.taxable * ratio), tax: Math.round(v.tax * ratio) }));
  // Make the parts add up exactly to what was charged.
  const taxDiff = booking.taxPaise - slabs.reduce((s, x) => s + x.tax, 0);
  const taxableDiff = booking.subtotalPaise - booking.discountPaise - slabs.reduce((s, x) => s + x.taxable, 0);
  if (slabs.length) {
    slabs[slabs.length - 1]!.tax += taxDiff;
    slabs[slabs.length - 1]!.taxable += taxableDiff;
  }
  return slabs;
}

/**
 * GST tax invoice / receipt for one booking. Plain server component with no admin dependencies, so it is used for
 * both the admin print view and the guest's receipt. Print styles are A4 and remove everything but the document.
 */
export function InvoiceDocument({
  booking,
  settings,
  invoiceNumber,
}: {
  booking: InvoiceBooking;
  settings: SiteSettings;
  /** Without a number (a guest's stay that has not ended yet) this prints as a booking confirmation, not an invoice. */
  invoiceNumber: string | null;
}) {
  const { hotel, gst, contact } = settings;
  const isConfirmation = !invoiceNumber;
  const isTaxInvoice = !isConfirmation && !!gst.gstin;
  const title = isConfirmation ? "Booking confirmation" : isTaxInvoice ? "Tax invoice" : "Receipt";
  const items = lines(booking);
  const slabs = taxSlabs(booking);
  const paid = booking.payments.reduce(
    (s, p) => (p.status === "PAID" ? s + p.amountPaise : p.status === "REFUNDED" ? s - p.amountPaise : s),
    0,
  );
  const balance = booking.totalPaise - paid;
  const issued = isConfirmation ? booking.createdAt : (booking.checkedOutAt ?? new Date());
  const payments = booking.payments.filter((p) => p.status === "PAID" || p.status === "REFUNDED");
  const cell = "border-b border-line px-2 py-2 align-top";
  const head = "border-b border-line-strong px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <article className="invoice-doc bg-bg text-ink mx-auto w-full max-w-[210mm] p-6 text-sm sm:p-10" aria-label={title}>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .invoice-doc { max-width: none; padding: 0; box-shadow: none !important; border: 0 !important; color: #000; background: #fff; }
          .invoice-doc .text-muted { color: #444 !important; }
          .invoice-doc tr { break-inside: avoid; }
        }
      `}</style>

      <header className="border-accent flex flex-wrap items-start justify-between gap-6 border-b-2 pb-5">
        <div>
          <p className="font-heading text-2xl">{gst.legalName || hotel.name}</p>
          {gst.legalName && gst.legalName !== hotel.name ? <p className="text-muted">{hotel.name}</p> : null}
          <p className="text-muted mt-1 max-w-sm">
            {hotel.addressLine}, {hotel.locality}, {hotel.city}, {hotel.state} {hotel.postalCode}
          </p>
          <p className="text-muted">
            {[contact.phone && `Phone ${contact.phone}`, contact.email].filter(Boolean).join(" · ")}
          </p>
          {isTaxInvoice ? <p className="mt-1 font-medium">GSTIN {gst.gstin}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-heading text-xl">{title}</p>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5">
            {invoiceNumber ? (
              <>
                <dt className="text-muted">{isTaxInvoice ? "Invoice no." : "Receipt no."}</dt>
                <dd className="font-medium tabular-nums">{invoiceNumber}</dd>
              </>
            ) : null}
            <dt className="text-muted">{isConfirmation ? "Booked on" : "Date"}</dt>
            <dd className="tabular-nums">
              {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(issued)}
            </dd>
            <dt className="text-muted">Booking ref.</dt>
            <dd className="tabular-nums">{booking.reference}</dd>
            {isTaxInvoice ? (
              <>
                <dt className="text-muted">Place of supply</dt>
                <dd>{hotel.state}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </header>

      <section className="grid gap-6 py-5 sm:grid-cols-2">
        <div>
          <p className="text-muted text-xs font-semibold tracking-wide uppercase">Billed to</p>
          <p className="mt-1 font-medium">{booking.guest.name}</p>
          <p className="text-muted">{booking.guest.phone}</p>
          {booking.guest.email ? <p className="text-muted">{booking.guest.email}</p> : null}
          {booking.guest.city ? <p className="text-muted">{booking.guest.city}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-muted text-xs font-semibold tracking-wide uppercase">Stay</p>
          <p className="mt-1">
            {formatDay(booking.checkIn, "en-IN", { year: "numeric" })} to {formatDay(booking.checkOut, "en-IN", { year: "numeric" })}
          </p>
          <p className="text-muted">
            {booking.nights} night{booking.nights === 1 ? "" : "s"} · {booking.rooms.length} room{booking.rooms.length === 1 ? "" : "s"} · {booking.adults} adult
            {booking.adults === 1 ? "" : "s"}
            {booking.children ? `, ${booking.children} child${booking.children === 1 ? "" : "ren"}` : ""}
          </p>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse">
          <thead>
            <tr>
              <th className={head}>Description</th>
              {isTaxInvoice ? <th className={head}>SAC</th> : null}
              <th className={`${head} text-right`}>Nights</th>
              <th className={`${head} text-right`}>Rate</th>
              <th className={`${head} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i}>
                <td className={cell}>
                  <p>{l.description}</p>
                  <p className="text-muted text-xs">{l.detail}</p>
                </td>
                {isTaxInvoice ? <td className={`${cell} tabular-nums`}>{gst.sacCode}</td> : null}
                <td className={`${cell} text-right tabular-nums`}>{l.qty}</td>
                <td className={`${cell} text-right tabular-nums`}>{formatINR(l.ratePaise, true)}</td>
                <td className={`${cell} text-right tabular-nums`}>{formatINR(l.amountPaise, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-5 grid gap-6 sm:grid-cols-[1fr_minmax(16rem,auto)]">
        <div className="text-muted grid content-start gap-2 text-xs">
          <p>
            <span className="text-ink font-medium">Amount in words:</span> {rupeesInWords(booking.totalPaise)}
          </p>
          {isConfirmation ? (
            <p>This is a booking confirmation, not a tax invoice. The final invoice is issued at check-out.</p>
          ) : isTaxInvoice ? (
            <p>Intra-state supply: GST is split equally between CGST and SGST. SAC {gst.sacCode}: room accommodation services.</p>
          ) : (
            <p>This is a payment receipt, not a GST tax invoice.</p>
          )}
        </div>
        <dl className="grid gap-1.5 tabular-nums">
          <div className="flex justify-between gap-6">
            <dt className="text-muted">Room charges</dt>
            <dd>{formatINR(booking.subtotalPaise, true)}</dd>
          </div>
          {booking.discountPaise ? (
            <div className="flex justify-between gap-6">
              <dt className="text-muted">Discount{booking.couponCode ? ` (${booking.couponCode})` : ""}</dt>
              <dd>− {formatINR(booking.discountPaise, true)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-6">
            <dt className="text-muted">Taxable value</dt>
            <dd>{formatINR(booking.subtotalPaise - booking.discountPaise, true)}</dd>
          </div>
          {slabs.map((s) => {
            const cgst = Math.floor(s.tax / 2);
            return (
              <div key={s.pct} className="contents">
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">
                    CGST {s.pct / 2}%{slabs.length > 1 ? ` on ${formatINR(s.taxable)}` : ""}
                  </dt>
                  <dd>{formatINR(cgst, true)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">
                    SGST {s.pct / 2}%{slabs.length > 1 ? ` on ${formatINR(s.taxable)}` : ""}
                  </dt>
                  <dd>{formatINR(s.tax - cgst, true)}</dd>
                </div>
              </div>
            );
          })}
          <div className="border-ink mt-1 flex justify-between gap-6 border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatINR(booking.totalPaise, true)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-muted">Paid</dt>
            <dd>{formatINR(paid, true)}</dd>
          </div>
          <div className="flex justify-between gap-6 font-medium">
            <dt>{balance >= 0 ? "Balance due" : "Refund due"}</dt>
            <dd>{formatINR(Math.abs(balance), true)}</dd>
          </div>
        </dl>
      </section>

      {payments.length ? (
        <section className="mt-6">
          <p className="text-muted text-xs font-semibold tracking-wide uppercase">Payments</p>
          <ul className="mt-2 grid gap-1">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-3 tabular-nums">
                <span>
                  {formatDateTime(p.paidAt ?? p.createdAt)} · {METHOD[p.method] ?? p.method}
                  {p.status === "REFUNDED" ? " (refund)" : ""}
                </span>
                <span>
                  {p.status === "REFUNDED" ? "− " : ""}
                  {formatINR(p.amountPaise, true)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-line text-muted mt-8 border-t pt-4 text-xs">
        <p>
          {isConfirmation ? `We look forward to welcoming you at ${hotel.name}.` : `Thank you for staying with ${hotel.name}.`} This is a
          computer-generated document and needs no signature.
        </p>
      </footer>
    </article>
  );
}
