"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  use,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action";
import { submitKeepingValues } from "@/lib/form-submit";
import { cn } from "@/lib/utils";

/* ───────── ActionForm: server action + field errors + toasts ───────── */

type FormAction<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

const FormCtx = createContext<{ errors: Record<string, string[] | undefined>; pending: boolean }>({
  errors: {},
  pending: false,
});
export const useFormErrors = () => useContext(FormCtx);

export function ActionForm<T>({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  refresh = true,
  onSuccess,
  id,
}: {
  action: FormAction<T>;
  children: React.ReactNode;
  className?: string;
  /** Toast on success. A string wins over the server's message; null shows only the server's message; omitted shows the server's message or "Saved.". */
  successMessage?: string | null;
  resetOnSuccess?: boolean;
  refresh?: boolean;
  onSuccess?: (data: T) => void;
  id?: string;
}) {
  // Toast as soon as the action settles, not in an effect: saving can change the parent's data so this
  // form unmounts (e.g. an "add" form hidden once a list is full), and an effect would never run.
  const [state, formAction, pending] = useActionState<ActionResult<T> | null, FormData>(async (prev, fd) => {
    const res = await action(prev, fd);
    if (res.ok) {
      const msg = successMessage === undefined ? (res.message ?? "Saved.") : (successMessage ?? res.message);
      if (msg) toast.success(msg);
    } else toast.error(res.error);
    return res;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const last = useRef<typeof state>(null);
  // Bumped after a successful "add" so every field remounts empty, including client-state
  // controls (media picker, icon picker) that a native form.reset() can't clear.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (resetOnSuccess) setResetKey((k) => k + 1);
      onSuccess?.(state.data);
      if (refresh) router.refresh();
    } else {
      // Move focus to the first field with an error so keyboard and screen reader users land on it.
      const first = state.fieldErrors ? Object.keys(state.fieldErrors)[0] : null;
      if (first) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`);
        el?.focus();
      }
    }
  }, [state, resetOnSuccess, onSuccess, refresh, router]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <FormCtx.Provider value={{ errors, pending }}>
      <form
        key={resetKey}
        ref={formRef}
        id={id}
        action={formAction}
        // Keeps what the user typed when the server returns errors; successful "add" forms are cleared via resetKey.
        onSubmit={submitKeepingValues(formAction)}
        className={className}
      >
        {children}
      </form>
    </FormCtx.Provider>
  );
}

const REACT_LAZY = Symbol.for("react.lazy");
type LazyNode = { $$typeof: symbol; _payload: PromiseLike<unknown> };
const isLazyNode = (v: unknown): v is LazyNode =>
  typeof v === "object" &&
  v !== null &&
  (v as { $$typeof?: unknown }).$$typeof === REACT_LAZY &&
  typeof (v as { _payload?: { then?: unknown } })._payload?.then === "function";

/**
 * In production, React streams large Server Component payloads in chunks, so an element a server page passes
 * as `children` can arrive as a lazy reference with no `props` yet. Unwrap it (as Radix Slot does) before cloning.
 */
function useUnwrappedElement(node: React.ReactNode): unknown {
  let value: unknown = node;
  while (isLazyNode(value)) value = use(value._payload);
  return value;
}

/** Label + control + hint + error for a field inside <ActionForm>. The control gets id/aria wiring automatically. */
export function FormField({
  name,
  label,
  hint,
  optional,
  className,
  children,
}: {
  name: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const { errors } = useFormErrors();
  const uid = useId();
  const child = useUnwrappedElement(children);
  const childProps = isValidElement<Record<string, unknown>>(child) ? child.props : {};
  const id = (childProps.id as string | undefined) ?? `${uid}-${name}`;
  const error = errors[name]?.[0];
  const msgId = `${id}-msg`;
  const control = isValidElement<Record<string, unknown>>(child)
    ? cloneElement(child, {
        id,
        name: childProps.name ?? name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? msgId : undefined,
      })
    : children;
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="text-muted ml-1.5 font-normal">(optional)</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={msgId} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children = "Save changes",
  pendingLabel = "Saving…",
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** English + Hindi inputs for one piece of content. Submits `${name}En` and `${name}Hi`. */
export function BilingualField({
  name,
  label,
  defaultValue,
  multiline,
  rows = 4,
  required = true,
  hint,
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue?: { en: string; hi: string };
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: string;
  maxLength?: number;
}) {
  const { errors } = useFormErrors();
  const uid = useId();
  const field = (lang: "En" | "Hi") => {
    const fname = `${name}${lang}`;
    const id = `${uid}-${fname}`;
    const error = errors[fname]?.[0];
    const common = {
      id,
      name: fname,
      defaultValue: lang === "En" ? defaultValue?.en : defaultValue?.hi,
      required: lang === "En" && required,
      maxLength,
      lang: lang === "En" ? "en" : "hi",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-msg` : undefined,
    };
    return (
      <div className="grid content-start gap-1">
        <label htmlFor={id} className="text-muted text-xs font-medium">
          {lang === "En" ? "English" : "हिन्दी (Hindi)"}
          {lang === "Hi" ? <span className="font-normal"> – falls back to English if empty</span> : null}
        </label>
        {multiline ? <Textarea rows={rows} className="min-h-0" {...common} /> : <Input {...common} />}
        {error ? (
          <p id={`${id}-msg`} role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {field("En")}
        {field("Hi")}
      </div>
      {hint ? <p className="text-muted text-sm">{hint}</p> : null}
    </fieldset>
  );
}

/* ───────── Buttons that run a server action (with optional confirmation) ───────── */

type SimpleAction = (formData: FormData) => Promise<ActionResult<unknown>>;

export function useRunAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: SimpleAction, formData = new FormData(), opts: { success?: string; onDone?: () => void } = {}) =>
    start(async () => {
      const res = await action(formData);
      if (res.ok) {
        toast.success(res.message ?? opts.success ?? "Done.");
        opts.onDone?.();
        router.refresh();
      } else toast.error(res.error);
    });
  return { run, pending };
}

export function ActionButton({
  action,
  fields,
  success,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: SimpleAction;
  fields?: Record<string, string>;
  success?: string;
}) {
  const { run, pending } = useRunAction();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      onClick={() => {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields ?? {})) fd.set(k, v);
        run(action, fd, { success });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

export function ConfirmButton({
  action,
  fields,
  title,
  body,
  confirmLabel = "Confirm",
  success,
  reason,
  children,
  danger = true,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: SimpleAction;
  fields?: Record<string, string>;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  success?: string;
  reason?: { label: string; required?: boolean };
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");
  const { run, pending } = useRunAction();
  const uid = useId();
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-heading pr-10 text-xl">{title}</DialogTitle>
          {body ? <DialogDescription className="text-muted mt-2">{body}</DialogDescription> : null}
          <form
            className="mt-5 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              for (const [k, v] of Object.entries(fields ?? {})) fd.set(k, v);
              if (reason) fd.set("reason", why);
              run(action, fd, { success, onDone: () => setOpen(false) });
            }}
          >
            {reason ? (
              <div className="grid gap-1.5">
                <Label htmlFor={`${uid}-reason`}>
                  {reason.label}
                  {reason.required ? null : <span className="text-muted ml-1.5 font-normal">(optional)</span>}
                </Label>
                <Textarea
                  id={`${uid}-reason`}
                  rows={3}
                  className="min-h-0"
                  value={why}
                  required={reason.required}
                  maxLength={500}
                  onChange={(e) => setWhy(e.target.value)}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending} aria-busy={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {confirmLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Checkbox styled for admin forms. Unchecked boxes submit nothing, so actions treat a missing key as false. */
export function Checkbox({
  name,
  label,
  defaultChecked,
  value = "on",
  hint,
  disabled,
}: {
  name: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
  value?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  const uid = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={uid}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="accent-[var(--color-accent)] mt-0.5 size-5 shrink-0 rounded"
      />
      <label htmlFor={uid} className="grid gap-0.5 text-sm">
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}
