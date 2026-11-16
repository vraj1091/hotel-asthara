import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for guest ID numbers.
 * Stored format:  v1.<iv>.<authTag>.<ciphertext>   (all base64url)
 * Key: ID_ENCRYPTION_KEY = 32 random bytes, base64.  Generate with: openssl rand -base64 32
 * Losing the key makes stored IDs unreadable, so back it up in your password manager.
 */
function getKey(): Buffer {
  const raw = process.env.ID_ENCRYPTION_KEY;
  if (!raw)
    throw new Error("ID_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ID_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptText(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported ciphertext format.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** "ABCDE12345" → "••••••2345" – safe to show to every staff role. */
export function maskId(last4: string | null | undefined) {
  return last4 ? `••••••${last4}` : "—";
}
