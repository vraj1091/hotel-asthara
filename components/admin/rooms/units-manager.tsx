"use client";

import { Plus } from "lucide-react";
import { ActionForm, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { deleteRoom, saveRoom } from "@/features/rooms/admin-actions";

export type UnitRow = {
  id: string;
  number: string;
  floor: number;
  status: "ACTIVE" | "MAINTENANCE";
  notes: string | null;
  upcoming: number; // upcoming/current bookings on this room
};

function UnitFields({ unit, compact }: { unit?: UnitRow; compact?: boolean }) {
  return (
    <>
      <FormField name="number" label="Room number">
        <Input required maxLength={20} defaultValue={unit?.number ?? ""} placeholder="201" className={compact ? "h-11" : undefined} />
      </FormField>
      <FormField name="floor" label="Floor">
        <Input type="number" min={-5} max={200} required defaultValue={unit?.floor ?? 2} className={compact ? "h-11" : undefined} />
      </FormField>
      <FormField name="status" label="Status">
        <NativeSelect defaultValue={unit?.status ?? "ACTIVE"} className={compact ? "h-11" : undefined}>
          <option value="ACTIVE">Active – can be booked</option>
          <option value="MAINTENANCE">Maintenance – not bookable</option>
        </NativeSelect>
      </FormField>
      <FormField name="notes" label="Notes" optional>
        <Input maxLength={300} defaultValue={unit?.notes ?? ""} placeholder="e.g. Street-facing" className={compact ? "h-11" : undefined} />
      </FormField>
    </>
  );
}

export function UnitsManager({
  roomTypeId,
  units,
  canWrite,
}: {
  roomTypeId: string;
  units: UnitRow[];
  canWrite: boolean;
}) {
  return (
    <div className="grid gap-6">
      {units.length === 0 ? (
        <p className="bg-surface-2 rounded-xl p-4 text-sm">
          This room type has no rooms yet, so guests cannot book it. Add each room number below.
        </p>
      ) : (
        <ul className="grid gap-3">
          {units.map((u) =>
            canWrite ? (
              <li key={u.id} className="border-line rounded-xl border p-4">
                <ActionForm action={saveRoom} successMessage={`Room ${u.number} saved.`} className="grid gap-4">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="roomTypeId" value={roomTypeId} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[8rem_6rem_minmax(12rem,1fr)_minmax(12rem,1.4fr)]">
                    <UnitFields unit={u} compact />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SubmitButton size="sm">Save room {u.number}</SubmitButton>
                    <ConfirmButton
                      action={deleteRoom}
                      fields={{ id: u.id }}
                      title={`Remove room ${u.number}?`}
                      body={
                        u.upcoming
                          ? `Room ${u.number} has ${u.upcoming} upcoming booking${u.upcoming === 1 ? "" : "s"}, so it cannot be removed until they are moved. Set it to Maintenance instead to stop new bookings.`
                          : "It will no longer be bookable. Past bookings keep their history, and adding the same number again restores it."
                      }
                      confirmLabel="Remove room"
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                    >
                      Remove
                    </ConfirmButton>
                    {u.status === "MAINTENANCE" ? <Badge tone="warning">Not bookable</Badge> : null}
                    {u.upcoming ? (
                      <span className="text-muted text-sm">
                        {u.upcoming} upcoming booking{u.upcoming === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </ActionForm>
              </li>
            ) : (
              <li key={u.id} className="border-line flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
                <span className="font-semibold">Room {u.number}</span>
                <span className="text-muted">Floor {u.floor}</span>
                {u.status === "MAINTENANCE" ? <Badge tone="warning">Maintenance</Badge> : <Badge tone="success">Active</Badge>}
                {u.notes ? <span className="text-muted">{u.notes}</span> : null}
              </li>
            ),
          )}
        </ul>
      )}

      {canWrite ? (
        <div className="bg-surface-2 rounded-xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="size-4" aria-hidden /> Add a room
          </h3>
          <ActionForm action={saveRoom} resetOnSuccess successMessage="Room added." className="grid gap-4">
            <input type="hidden" name="roomTypeId" value={roomTypeId} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[8rem_6rem_minmax(12rem,1fr)_minmax(12rem,1.4fr)]">
              <UnitFields />
            </div>
            <SubmitButton size="sm" className="w-fit" pendingLabel="Adding…">
              Add room
            </SubmitButton>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
