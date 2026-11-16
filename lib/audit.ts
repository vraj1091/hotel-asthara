import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";

/** Append-only record of who did what. Never throws: a logging failure must not block the action. */
export async function writeAudit(entry: {
  userId?: string | null;
  action: string; // "booking.cancel"
  entity: string; // "Booking"
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  try {
    let ip: string | null = null;
    try {
      ip = clientIp(await headers());
    } catch {
      /* called outside a request (seed, cron) */
    }
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        meta: entry.meta,
        ip,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write entry", error);
  }
}
