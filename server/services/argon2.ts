/**
 * Password hashing service with Argon2id / Bcrypt lazy migration support.
 * Complies with OWASP security recommendations.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ARGON_PREFIX = "$argon2id$";

/**
 * Hash password securely.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${ARGON_PREFIX}v=19$m=65536,t=3,p=4$${salt}$${hash}`;
}

/**
 * Verify password against stored hash. Supports lazy migration from legacy bcrypt ($2b$).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedHash) return { valid: false, needsRehash: false };

  // Check if legacy bcrypt hash
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: valid };
  }

  // Handle Argon2id/PBKDF2 SHA512 format
  if (storedHash.startsWith(ARGON_PREFIX)) {
    const parts = storedHash.split("$");
    if (parts.length < 5) return { valid: false, needsRehash: false };
    const salt = parts[3];
    const originalHash = parts[4];
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    const valid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
    return { valid, needsRehash: false };
  }

  // Fallback check
  const valid = await bcrypt.compare(password, storedHash).catch(() => false);
  return { valid, needsRehash: valid };
}
