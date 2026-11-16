"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { ActionForm, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { deleteBlock, saveBlock } from "@/features/rooms/admin-actions";
import { formatDay } from "@/lib/utils";

export type BlockRow = {
  id: string;
  roomId: string | null;
  roomNumber: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  past: boolean;
  conflicts: { reference: string; guest: string; id: string; roomNumber: string }[];
};

const day = (d: string) => formatDay(d, "en-IN", { year: "numeric" });

function BlockForm({
  roomTypeId,
  roomName,
  rooms,
  block,
  today,
  onDone,
}: {
  roomTypeId: string;
  roomName: string;
  rooms: { id: string; number: string }[];
  block?: BlockRow;
  today: string;
  onDone: () => void;
}) {
  return (
    <ActionForm action={saveBlock} onSuccess={onDone} successMessage="Dates blocked." className="grid gap-5">
      {block ? <input type="hidden" name="id" value={block.id} /> : null}
      <input type="hidden" name="roomTypeId" value={roomTypeId} />
      <FormField name="target" label="What to block">
        <NativeSelect defaultValue={block?.roomId ?? "type"}>
          <option value="type">Every {roomName} (stop selling the type)</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              Only room {r.number}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="startDate" label="Blocked from (first night)">
          <Input type="date" required min={block ? undefined : today} defaultValue={block?.startDate ?? today} />
        </FormField>
        <FormField name="endDate" label="Up to, not including" hint="Like a check-out date: this night is bookable again.">
          <Input type="date" required defaultValue={block?.endDate ?? ""} />
        </FormField>
      </div>
      <FormField name="reason" label="Reason" optional hint="Only staff see this.">
        <Input maxLength={200} defaultValue={block?.reason ?? ""} placeholder="Painting, deep cleaning, owner's use…" />
      </FormField>
      <SubmitButton className="w-fit">{block ? "Save block" : "Block dates"}</SubmitButton>
    </ActionForm>
  );
}

export function BlocksManager({
  roomTypeId,
  roomName,
  rooms,
  blocks,
  canWrite,
  today,
}: {
  roomTypeId: string;
  roomName: string;
  rooms: { id: string; number: string }[];
  blocks: BlockRow[];
  canWrite: boolean;
  today: string;
}) {
  const [editing, setEditing] = useState<BlockRow | "new" | null>(null);
  const [showPast, setShowPast] = useState(false);
  const pastCount = blocks.filter((b) => b.past).length;
  const shown = blocks.filter((b) => showPast || !b.past);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-prose text-sm">
          Blocked dates cannot be booked online or at the desk. Blocking does not cancel bookings that already exist.
        </p>
        {canWrite ? (
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Block dates
          </Button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="bg-surface-2 rounded-xl p-4 text-sm">No upcoming blocked dates for {roomName}.</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((b) => (
            <li key={b.id} className="border-line grid gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {b.roomNumber ? `Room ${b.roomNumber}` : `All ${roomName}s`}
                    {b.past ? <Badge tone="neutral">Past</Badge> : null}
                  </p>
                  <p className="text-muted mt-1 text-sm">
                    Blocked from {day(b.startDate)} up to (not including) {day(b.endDate)}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(b)}>
                      <Pencil aria-hidden /> Edit
                    </Button>
                    <ConfirmButton
                      action={deleteBlock}
                      fields={{ id: b.id }}
                      title="Remove this block?"
                      body="These dates become bookable again straight away."
                      confirmLabel="Remove block"
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                ) : null}
              </div>
              {b.conflicts.length ? (
                <div role="note" className="border-warning/40 bg-warning/10 flex gap-3 rounded-lg border p-3 text-sm">
                  <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">
                      {b.conflicts.length} booking{b.conflicts.length === 1 ? " overlaps" : "s overlap"} this block and
                      still stand{b.conflicts.length === 1 ? "s" : ""}:
                    </p>
                    <ul className="mt-1 grid gap-0.5">
                      {b.conflicts.map((c) => (
                        <li key={`${c.id}-${c.roomNumber}`}>
                          <a href={`/admin/bookings/${c.id}`} className="link-underline font-mono">
                            {c.reference}
                          </a>{" "}
                          – {c.guest}, room {c.roomNumber}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {pastCount ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setShowPast((v) => !v)}>
          {showPast ? "Hide past blocks" : `Show ${pastCount} past block${pastCount === 1 ? "" : "s"}`}
        </Button>
      ) : null}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
          <DialogTitle className="font-heading pr-10 text-xl">
            {editing === "new" ? "Block dates" : "Edit blocked dates"}
          </DialogTitle>
          <DialogDescription className="text-muted mt-1 mb-5 text-sm">
            For maintenance, renovation or private use.
          </DialogDescription>
          {editing !== null ? (
            <BlockForm
              key={editing === "new" ? "new" : editing.id}
              roomTypeId={roomTypeId}
              roomName={roomName}
              rooms={rooms}
              block={editing === "new" ? undefined : editing}
              today={today}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
