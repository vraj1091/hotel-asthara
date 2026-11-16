"use client";

import { useId, useState } from "react";
import { useFormErrors } from "@/components/admin/forms";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * English + Hindi inputs with a live character count against a recommended length (search results cut off long
 * titles and descriptions). Submits `${name}En` and `${name}Hi`, like <BilingualField>.
 */
export function CountedBilingualField({
  name,
  label,
  defaultValue,
  recommended,
  max,
  multiline,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: { en: string; hi: string };
  recommended: number;
  max: number;
  multiline?: boolean;
  hint?: string;
}) {
  const { errors } = useFormErrors();
  const uid = useId();
  const [values, setValues] = useState({ En: defaultValue?.en ?? "", Hi: defaultValue?.hi ?? "" });
  const field = (lang: "En" | "Hi") => {
    const fname = `${name}${lang}`;
    const id = `${uid}-${fname}`;
    const error = errors[fname]?.[0];
    const len = values[lang].length;
    const over = len > recommended;
    const props = {
      id,
      name: fname,
      value: values[lang],
      maxLength: max,
      required: lang === "En",
      lang: lang === "En" ? "en" : "hi",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValues((v) => ({ ...v, [lang]: e.target.value })),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": `${id}-count${error ? ` ${id}-msg` : ""}`,
    };
    return (
      <div className="grid content-start gap-1">
        <label htmlFor={id} className="text-muted text-xs font-medium">
          {lang === "En" ? "English" : "हिन्दी (Hindi)"}
          {lang === "Hi" ? <span className="font-normal"> – falls back to English if empty</span> : null}
        </label>
        {multiline ? <Textarea rows={3} className="min-h-0" {...props} /> : <Input {...props} />}
        <p id={`${id}-count`} className={cn("text-xs tabular-nums", over ? "text-warning" : "text-muted")}>
          {len} / about {recommended} characters{over ? " – search engines may cut this off" : ""}
        </p>
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
