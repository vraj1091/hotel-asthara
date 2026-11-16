import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Compared against when the email is unknown, so response time does not reveal which emails exist. */
export const DUMMY_HASH = "$2b$12$QBLORfEF2rRNse8rwjr7pe1/K7xqFLRTlx9fVhdj0.wKnphWI8.VK";

export const zPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .refine(
    (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v),
    "Include upper case, lower case and a number.",
  );
