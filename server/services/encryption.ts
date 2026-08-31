/**
 * AES-256-GCM authenticated encryption service.
 * Used for reversible sensitive data (e.g. payment reference tokens, credentials).
 * Never use for passwords (passwords are hashed with Argon2id/PBKDF2).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET_KEY = process.env.ENCRYPTION_KEY || "farmfreshfarmer-32byte-secret-key-change-me!";

const FALLBACK_JWT_SECRET = "farmfreshfarmer-production-jwt-master-secret-key-2026-v1-secure";

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  return FALLBACK_JWT_SECRET;
}

function getDerivedKey(): Buffer {
  return crypto.scryptSync(SECRET_KEY, "fff_salt_context", 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptData(plaintext: string): string {
  if (!plaintext) return "";
  const key = getDerivedKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string produced by encryptData.
 */
export function decryptData(encryptedData: string): string {
  if (!encryptedData) return "";
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return encryptedData; // return original if not encrypted format
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}
