/**
 * Pure Node.js standard crypto TOTP (RFC 6238 HMAC-SHA1) implementation.
 * Zero external npm dependencies. Compatible with Apple Passwords, Google Authenticator,
 * 1Password, and Authy.
 */
import crypto from "crypto";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateHotp(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = crypto.createHmac("sha1", secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (code % 1000000).toString();
  return otp.padStart(6, "0");
}

/** Generate a new TOTP secret string and OTP auth URI */
export function generateTotpSecret(accountName = "admin@farmfreshfarmer.com"): { secret: string; uri: string } {
  const randomBytes = crypto.randomBytes(20);
  const secret = base32Encode(randomBytes);
  const uri = `otpauth://totp/FarmFreshFarmer:${encodeURIComponent(accountName)}?secret=${secret}&issuer=FarmFreshFarmer`;
  return { secret, uri };
}

/** Verify a 6-digit TOTP code against a base32 secret with ±1 time step tolerance (30s window) */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  const cleanCode = code.trim().replace(/\s+/g, "");
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) return false;

  try {
    const secretBuffer = base32Decode(secret);
    const timeStep = 30;
    const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

    for (let window = -1; window <= 1; window++) {
      const generated = generateHotp(secretBuffer, currentCounter + window);
      if (generated === cleanCode) {
        return true;
      }
    }
  } catch (e) {
    console.error("[TOTP VERIFY ERROR]", e);
  }
  return false;
}
