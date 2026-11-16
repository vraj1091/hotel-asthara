import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { guestSearchWhere, summarize } from "@/features/guests/queries";
import { staffWithAny } from "@/lib/session";
import { dayKey, todayIST } from "@/lib/utils";

/** Escape for CSV and neutralise spreadsheet formulas (=, +, -, @, tab, CR at the start of a cell). */
function cell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Guest list as CSV. Never includes ID numbers. */
export async function GET(request: Request) {
  const staff = await staffWithAny(["guests:export"]);
  if (!staff) return NextResponse.json({ error: "You do not have permission to export guests." }, { status: 403 });
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const guests = await db.guest.findMany({
    where: guestSearchWhere(q),
    orderBy: { createdAt: "asc" },
    include: { bookings: { where: { deletedAt: null }, select: { status: true, checkIn: true, totalPaise: true } } },
  });
  const header = ["Name", "Phone", "Email", "City", "Stays", "Last stay", "Total spent (INR)", "Guest since", "Notes"];
  const lines = [header.map(cell).join(",")];
  for (const g of guests) {
    const s = summarize(g.bookings);
    lines.push(
      [
        g.name,
        g.phone,
        g.email ?? "",
        g.city ?? "",
        s.stays,
        s.lastStay ? dayKey(s.lastStay) : "",
        (s.spentPaise / 100).toFixed(2),
        g.createdAt.toISOString().slice(0, 10),
        g.notes ?? "",
      ]
        .map(cell)
        .join(","),
    );
  }
  await writeAudit({ userId: staff.id, action: "guest.export", entity: "Guest", meta: { count: guests.length, q: q ?? null } });
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guests-${dayKey(todayIST())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
