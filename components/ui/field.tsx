import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Label + control + hint/error, wired for screen readers. Pass the same `id` to the control and set aria-describedby={`${id}-msg`}. */
export function Field({
  id,
  label,
  hint,
  error,
  optionalText,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalText?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optionalText ? (
          <span className="text-muted ml-1.5 font-normal">({optionalText})</span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
