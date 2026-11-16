"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { ActionButton, ActionForm, Checkbox, ConfirmButton, FormField, SubmitButton, useFormErrors } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { deletePriceRule, savePriceRule, togglePriceRule } from "@/features/rooms/admin-actions";
import { formatDay, formatINR } from "@/lib/utils";

export type RuleRow = {
  id: string;
  name: string;
  kind: "WEEKEND" | "SEASONAL" | "FESTIVAL";
  adjustment: "PERCENT" | "FIXED_RATE";
  value: number;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[];
  priority: number;
  active: boolean;
  scope: "type" | "all";
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KIND_LABEL = { WEEKEND: "Days of the week", SEASONAL: "Season", FESTIVAL: "Festival / event" };

export function describeRule(r: Pick<RuleRow, "kind" | "adjustment" | "value" | "startDate" | "endDate" | "daysOfWeek">) {
  const amount =
    r.adjustment === "PERCENT"
      ? `${r.value > 0 ? "+" : "−"}${Math.abs(r.value)}% on the base rate`
      : `${formatINR(r.value)} per night`;
  const when =
    r.kind === "WEEKEND"
      ? `every ${r.daysOfWeek.map((d) => DAYS[d]).join(", ")}`
      : r.startDate && r.endDate
        ? `${formatDay(r.startDate, "en-IN", { year: "numeric" })} to ${formatDay(r.endDate, "en-IN", { year: "numeric" })}`
        : "";
  return `${amount}, ${when}`;
}

function DaysField({ defaultDays }: { defaultDays: number[] }) {
  const { errors } = useFormErrors();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Nights it applies to</legend>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((d, i) => (
          <label key={d} className="border-line-strong has-checked:bg-accent has-checked:border-accent has-checked:text-on-accent has-focus-visible:ring-accent has-focus-visible:ring-offset-bg has-focus-visible:ring-2 has-focus-visible:ring-offset-2 flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm">
            <input type="checkbox" name="days" value={i} defaultChecked={defaultDays.includes(i)} className="sr-only" />
            {d}
          </label>
        ))}
      </div>
      <p className="text-muted text-sm">A night counts by its check-in date: Friday and Saturday nights are the usual weekend.</p>
      {errors.days?.[0] ? (
        <p role="alert" className="text-danger text-sm">
          {errors.days[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

function RuleForm({ roomTypeId, roomName, rule, onDone }: { roomTypeId: string; roomName: string; rule?: RuleRow; onDone: () => void }) {
  const [kind, setKind] = useState<RuleRow["kind"]>(rule?.kind ?? "WEEKEND");
  const [adjustment, setAdjustment] = useState<RuleRow["adjustment"]>(rule?.adjustment ?? "PERCENT");
  const valueDefault = rule ? (rule.adjustment === "PERCENT" ? String(rule.value) : String(rule.value / 100)) : "";
  return (
    <ActionForm action={savePriceRule} onSuccess={onDone} successMessage="Rate rule saved." className="grid gap-5">
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
      <input type="hidden" name="roomTypeId" value={roomTypeId} />
      <FormField name="name" label="Rule name">
        <Input required maxLength={80} defaultValue={rule?.name ?? ""} placeholder="Weekend, Wedding season, Diwali…" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="scope" label="Applies to">
          <NativeSelect defaultValue={rule?.scope ?? "type"}>
            <option value="type">{roomName} only</option>
            <option value="all">All room types</option>
          </NativeSelect>
        </FormField>
        <FormField name="kind" label="Type of rule">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as RuleRow["kind"])}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      {kind === "WEEKEND" ? (
        <DaysField defaultDays={rule?.daysOfWeek ?? [5, 6]} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField name="startDate" label="First night">
            <Input type="date" required defaultValue={rule?.startDate ?? ""} />
          </FormField>
          <FormField name="endDate" label="Last night (included)">
            <Input type="date" required defaultValue={rule?.endDate ?? ""} />
          </FormField>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="adjustment" label="Price change">
          <NativeSelect value={adjustment} onChange={(e) => setAdjustment(e.target.value as RuleRow["adjustment"])}>
            <option value="PERCENT">Percentage of the base rate</option>
            <option value="FIXED_RATE">Fixed nightly rate</option>
          </NativeSelect>
        </FormField>
        <FormField
          name="value"
          label={adjustment === "PERCENT" ? "Change (%)" : "Nightly rate (₹, before GST)"}
          hint={adjustment === "PERCENT" ? "20 = 20% more, −10 = 10% less." : "Replaces the base rate on these nights."}
        >
          <Input
            key={adjustment}
            inputMode={adjustment === "PERCENT" ? "numeric" : "decimal"}
            required
            defaultValue={rule && rule.adjustment === adjustment ? valueDefault : ""}
            placeholder={adjustment === "PERCENT" ? "20" : "2499"}
          />
        </FormField>
      </div>
      <FormField name="priority" label="Priority" hint="When rules overlap, the higher number wins; on a tie festival beats season beats weekend.">
        <Input type="number" min={-100} max={100} required defaultValue={rule?.priority ?? 0} className="max-w-32" />
      </FormField>
      <Checkbox name="active" label="Active" defaultChecked={rule?.active ?? true} />
      <SubmitButton className="w-fit">{rule ? "Save rule" : "Add rule"}</SubmitButton>
    </ActionForm>
  );
}

export function RateRules({
  roomTypeId,
  roomName,
  rules,
  canWrite,
}: {
  roomTypeId: string;
  roomName: string;
  rules: RuleRow[];
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState<RuleRow | "new" | null>(null);
  return (
    <div className="grid gap-4">
      {canWrite ? (
        <Button type="button" className="w-fit" onClick={() => setEditing("new")}>
          <Plus aria-hidden /> Add rate rule
        </Button>
      ) : null}
      {rules.length === 0 ? (
        <p className="bg-surface-2 rounded-xl p-4 text-sm">
          No rate rules. {roomName} is sold at its base rate every night.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rules.map((r) => (
            <li key={r.id} className="border-line flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {r.name}
                  <Badge tone="neutral">{KIND_LABEL[r.kind]}</Badge>
                  {r.scope === "all" ? <Badge tone="gold">All room types</Badge> : null}
                  {r.active ? null : <Badge tone="warning">Off</Badge>}
                </p>
                <p className="text-muted mt-1 text-sm">
                  {describeRule(r)} · priority {r.priority}
                </p>
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(r)}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <ActionButton
                    action={togglePriceRule}
                    fields={{ id: r.id, active: String(!r.active) }}
                    size="sm"
                    variant="ghost"
                    success={r.active ? "Rule switched off." : "Rule switched on."}
                  >
                    {r.active ? "Switch off" : "Switch on"}
                  </ActionButton>
                  <ConfirmButton
                    action={deletePriceRule}
                    fields={{ id: r.id }}
                    title={`Delete “${r.name}”?`}
                    body={
                      r.scope === "all"
                        ? "This rule applies to every room type. Existing bookings keep their prices."
                        : "Existing bookings keep their prices."
                    }
                    confirmLabel="Delete rule"
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                  >
                    Delete
                  </ConfirmButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
          <DialogTitle className="font-heading pr-10 text-xl">
            {editing === "new" ? "Add rate rule" : "Edit rate rule"}
          </DialogTitle>
          <DialogDescription className="text-muted mt-1 mb-5 text-sm">
            Changes apply to new bookings. Confirmed bookings keep the price they were made at.
          </DialogDescription>
          {editing !== null ? (
            <RuleForm
              key={editing === "new" ? "new" : editing.id}
              roomTypeId={roomTypeId}
              roomName={roomName}
              rule={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
