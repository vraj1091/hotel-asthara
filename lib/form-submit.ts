import { startTransition, type FormEvent } from "react";

/**
 * onSubmit for a `<form action={dispatch}>` driven by useActionState.
 *
 * React resets a form after every `action` submission, even when the server answers with validation errors,
 * so the visitor would lose everything they typed. Preventing the default and dispatching inside a transition
 * keeps the values (and `useFormStatus` still reports pending). `check` runs first, for instant client-side
 * validation; return false to stop the submission.
 */
export function submitKeepingValues(dispatch: (formData: FormData) => void, check?: (formData: FormData) => boolean) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    if (check && !check(formData)) return;
    startTransition(() => dispatch(formData));
  };
}
