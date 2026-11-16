import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/** Standard result for every server action, so forms handle success and failure the same way. */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** An error whose message is safe and useful to show to the person who triggered it. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export async function runAction<T>(
  fn: () => Promise<T>,
  message?: string,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (error) {
    if (error instanceof ActionError)
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "Check the highlighted fields and try again.",
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return { ok: false, error: "That value is already in use. Choose a different one." };
      if (error.code === "P2025")
        return { ok: false, error: "That record no longer exists. Refresh the page." };
    }
    // Next.js redirects/not-found are thrown as errors and must keep propagating.
    if (
      error instanceof Error &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_")
    ) {
      throw error;
    }
    console.error("[action] unexpected error", error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}
