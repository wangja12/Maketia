import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * Encryption at rest for third-party credentials (AES-256-GCM).
 * Key: PAYMENT_SECRETS_KEY, 32 random bytes in base64 (`openssl rand -base64 32`).
 * Without it, credentials cannot be saved: never stored in clear.
 */

export class SecretsKeyMissingError extends Error {
  constructor() {
    super("Clé de chiffrement absente (PAYMENT_SECRETS_KEY) : impossible d’enregistrer des identifiants de paiement.");
    this.name = "SecretsKeyMissingError";
  }
}

function key() {
  const raw = process.env.PAYMENT_SECRETS_KEY;
  if (!raw) throw new SecretsKeyMissingError();
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("PAYMENT_SECRETS_KEY must be 32 bytes, base64-encoded");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1") throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
