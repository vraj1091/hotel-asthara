import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* Server-safe building blocks shared by every admin module. */

export function AdminPageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 grid gap-3 md:mb-8">
      {back ? (
        <Link href={back.href} className="text-muted hover:text-ink flex w-fit items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h2">{title}</h1>
          {description ? <div className="text-muted mt-1.5 max-w-[70ch]">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function AdminCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("card overflow-hidden shadow-none", className)}>
      {title || actions ? (
        <div className="border-line flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="font-sans text-base font-semibold">{title}</h2> : null}
            {description ? <p className="text-muted mt-0.5 text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "accent" | "dark";
}) {
  const body = (
    <>
      <p className={cn("text-sm", tone === "dark" ? "text-muted" : "text-muted")}>{label}</p>
      <p className="mt-1 font-sans text-2xl font-semibold tabular-nums md:text-3xl">{value}</p>
      {hint ? <p className="text-muted mt-1 text-sm">{hint}</p> : null}
    </>
  );
  const cls = cn(
    "card block p-5 shadow-none transition-colors",
    tone === "accent" && "border-accent/60 bg-accent-soft",
    tone === "dark" && "theme-dark",
    href && "hover:border-line-strong",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 px-6 py-14 text-center">
      {icon ? <div className="bg-surface-3 text-muted grid size-14 place-items-center rounded-2xl [&_svg]:size-6">{icon}</div> : null}
      <p className="font-heading text-xl">{title}</p>
      {body ? <p className="text-muted max-w-md">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ───────── Tables ───────── */

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 [-webkit-overflow-scrolling:touch]">
      <table className={cn("w-full min-w-[40rem] border-collapse text-left text-sm", className)}>
        {children}
      </table>
    </div>
  );
}
export const Th = ({ children, className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    scope="col"
    className={cn("text-muted border-line border-b px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap uppercase first:pl-0 last:pr-0", className)}
    {...p}
  >
    {children}
  </th>
);
export const Td = ({ children, className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("border-line border-b px-3 py-3 align-top first:pl-0 last:pr-0", className)} {...p}>
    {children}
  </td>
);

/* ───────── Pagination (links keep the current filters) ───────── */

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="text-muted mt-4 text-sm">{total} total</p>;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const link = "border-line-strong hover:bg-surface-2 inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm";
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        Page {page} of {pages}, {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={link} rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={link} rel="next">
            Next <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function parsePage(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/* ───────── Link tabs for sub-pages (Website editor, Settings, Room editor) ───────── */

export function LinkTabs({
  tabs,
  current,
}: {
  tabs: { href: string; label: string; key: string }[];
  current: string;
}) {
  return (
    <nav aria-label="Sections" className="border-line -mx-4 mb-6 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center border-b-2 px-3.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-accent text-ink font-medium"
                    : "text-muted hover:text-ink border-transparent",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ───────── Status badges ───────── */

const BOOKING_TONE = {
  PENDING: "warning",
  CONFIRMED: "gold",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
} as const;
export const BOOKING_STATUS_LABEL: Record<keyof typeof BOOKING_TONE, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};
export function BookingStatusBadge({ status }: { status: keyof typeof BOOKING_TONE }) {
  return <Badge tone={BOOKING_TONE[status]}>{BOOKING_STATUS_LABEL[status]}</Badge>;
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  RAZORPAY: "Razorpay (online)",
  PAY_AT_HOTEL: "Pay at hotel",
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

export function PaymentBadge({ totalPaise, paidPaise }: { totalPaise: number; paidPaise: number }) {
  if (paidPaise <= 0) return <Badge tone="warning">Unpaid</Badge>;
  if (paidPaise < totalPaise) return <Badge tone="gold">Part paid</Badge>;
  return <Badge tone="success">Paid</Badge>;
}

const ENQUIRY_TONE = { NEW: "gold", IN_PROGRESS: "warning", REPLIED: "success", CLOSED: "neutral" } as const;
export const ENQUIRY_STATUS_LABEL: Record<keyof typeof ENQUIRY_TONE, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  REPLIED: "Replied",
  CLOSED: "Closed",
};
export function EnquiryStatusBadge({ status }: { status: keyof typeof ENQUIRY_TONE }) {
  return <Badge tone={ENQUIRY_TONE[status]}>{ENQUIRY_STATUS_LABEL[status]}</Badge>;
}

/* ───────── Description list ───────── */

export function DetailList({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Native select + input styles for filter bars (GET forms) */
export const filterControl =
  "h-10 rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink";
