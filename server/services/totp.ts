/**
 * TOTP (Time-based One-Time Password) service for 2FA.
 * Uses standard HMAC-SHA1 algorithm (RFC 6238) without external dependencies.
 */
import crypto from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(base32Str: string): Buffer {
  const cleanStr = base32Str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleanStr.length; i++) {
    const idx = ALPHABET.indexOf(cleanStr[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): { secret: string; uri: string } {
  const buffer = crypto.randomBytes(20);
  const secret = base32Encode(buffer);
  const issuer = encodeURIComponent("FarmFreshFarmer");
  const account = encodeURIComponent("admin@farmfreshfarmer.com");
  const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri };
}

export function generateTotpCode(secret: string, timeStepWindow = 0): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepWindow;

  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (codeInt % 1000000).toString().padStart(6, "0");
  return otp;
}

/**
 * Verify TOTP 6-digit code with +/- 1 window (30s tolerance).
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!secret || !code || code.length !== 6) return false;
  for (let window = -1; window <= 1; window++) {
    const expected = generateTotpCode(secret, window);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}
