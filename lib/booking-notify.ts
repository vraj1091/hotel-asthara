import "server-only";
import { db } from "@/lib/db";
import { emailLayout, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { absoluteUrl, formatDay, formatINR, formatTime } from "@/lib/utils";

const PAYMENT_LABEL: Record<string, string> = {
  RAZORPAY: "Paid online",
  PAY_AT_HOTEL: "Pay at hotel",
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

async function load(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      rooms: { include: { roomType: true, room: true } },
      payments: true,
    },
  });
}

function hotelRecipients(settings: Awaited<ReturnType<typeof getSettings>>) {
  const list = settings.notifications.hotelEmails.filter(Boolean);
  if (list.length === 0 && settings.contact.email) list.push(settings.contact.email);
  return list;
}

function summaryRows(b: NonNullable<Awaited<ReturnType<typeof load>>>): [string, string][] {
  const byType = new Map<string, number>();
  for (const r of b.rooms) byType.set(r.roomType.name, (byType.get(r.roomType.name) ?? 0) + 1);
  const paid = b.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amountPaise, 0);
  return [
    ["Booking reference", b.reference],
    ["Guest", b.guest.name],
    ["Check-in", formatDay(b.checkIn, "en-IN", { year: "numeric" })],
    ["Check-out", formatDay(b.checkOut, "en-IN", { year: "numeric" })],
    ["Nights", String(b.nights)],
    ["Rooms", [...byType].map(([n, c]) => `${c} × ${n}`).join(", ")],
    ["Guests", `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`],
    ["Room charges", formatINR(b.subtotalPaise, true)],
    ...(b.discountPaise ? ([["Discount", `− ${formatINR(b.discountPaise, true)}`]] as [string, string][]) : []),
    ["GST", formatINR(b.taxPaise, true)],
    ["Total", formatINR(b.totalPaise, true)],
    ["Payment", paid >= b.totalPaise ? `Paid ${formatINR(paid, true)}` : PAYMENT_LABEL[b.paymentMethod] ?? b.paymentMethod],
  ];
}

/** Guest confirmation + hotel notification. Safe to call more than once; never throws. */
export async function sendBookingEmails(bookingId: string) {
  try {
    const [b, settings] = await Promise.all([load(bookingId), getSettings()]);
    if (!b) return;
    const name = settings.hotel.name;
    const rows = summaryRows(b);
    const manage = absoluteUrl(`/booking/manage?ref=${encodeURIComponent(b.reference)}`);

    if (b.guest.email && settings.notifications.sendGuestConfirmation) {
      const { html, text } = emailLayout({
        hotelName: name,
        title: "Your booking is confirmed",
        intro: `Thank you, ${b.guest.name.split(" ")[0]}. We look forward to welcoming you.`,
        rows,
        paragraphs: [
          `Check-in is from ${formatTime(settings.hotel.checkInTime)} and check-out is by ${formatTime(settings.hotel.checkOutTime)}.`,
          settings.policies.idPolicy.en,
          `${settings.hotel.addressLine}, ${settings.hotel.locality}, ${settings.hotel.city} ${settings.hotel.postalCode}`,
          settings.contact.phone ? `Front desk: ${settings.contact.phone}` : "",
        ].filter(Boolean),
        button: { label: "Manage your booking", url: manage },
        footer: `You can view, pay for or cancel this booking online with reference ${b.reference} and the phone number or email you booked with.`,
      });
      await sendEmail({
        kind: "booking.guest",
        to: b.guest.email,
        subject: `Booking confirmed: ${b.reference} – ${name}`,
        html,
        text,
        replyTo: settings.contact.email || undefined,
        bookingId: b.id,
      });
    }

    const to = hotelRecipients(settings);
    if (to.length) {
      const { html, text } = emailLayout({
        hotelName: name,
        title: `New ${b.source === "WEBSITE" ? "website" : b.source.toLowerCase().replace("_", "-")} booking`,
        rows: [...rows, ["Phone", b.guest.phone], ["Email", b.guest.email ?? "—"]],
        paragraphs: b.specialRequests ? [`Guest note: ${b.specialRequests}`] : [],
        button: { label: "Open in admin", url: absoluteUrl(`/admin/bookings/${b.id}`) },
      });
      await sendEmail({
        kind: "booking.hotel",
        to,
        subject: `New booking ${b.reference}: ${b.guest.name}, ${formatDay(b.checkIn)} – ${formatDay(b.checkOut)}`,
        html,
        text,
        bookingId: b.id,
      });
    }
  } catch (error) {
    console.error("[booking-notify] could not send booking emails", error);
  }
}

export async function sendCancellationEmails(bookingId: string, byGuest: boolean) {
  try {
    const [b, settings] = await Promise.all([load(bookingId), getSettings()]);
    if (!b) return;
    const name = settings.hotel.name;
    const rows: [string, string][] = [
      ["Booking reference", b.reference],
      ["Guest", b.guest.name],
      ["Check-in", formatDay(b.checkIn, "en-IN", { year: "numeric" })],
      ["Check-out", formatDay(b.checkOut, "en-IN", { year: "numeric" })],
    ];
    if (b.guest.email) {
      const { html, text } = emailLayout({
        hotelName: name,
        title: "Your booking has been cancelled",
        rows,
        paragraphs: [
          b.payments.some((p) => p.status === "PAID" || p.status === "REFUNDED")
            ? "Any online payment for this booking is refunded to the original payment method within 5 to 7 working days."
            : "No payment was taken for this booking.",
          settings.contact.phone ? `Questions? Call the front desk on ${settings.contact.phone}.` : "",
        ].filter(Boolean),
      });
      await sendEmail({
        kind: "booking.cancelled",
        to: b.guest.email,
        subject: `Booking cancelled: ${b.reference} – ${name}`,
        html,
        text,
        bookingId: b.id,
      });
    }
    const to = hotelRecipients(settings);
    if (to.length && byGuest) {
      const { html, text } = emailLayout({
        hotelName: name,
        title: "A guest cancelled online",
        rows: [...rows, ["Phone", b.guest.phone]],
        button: { label: "Open in admin", url: absoluteUrl(`/admin/bookings/${b.id}`) },
      });
      await sendEmail({
        kind: "booking.cancelled",
        to,
        subject: `Cancelled ${b.reference}: ${b.guest.name}`,
        html,
        text,
        bookingId: b.id,
      });
    }
  } catch (error) {
    console.error("[booking-notify] could not send cancellation emails", error);
  }
}
