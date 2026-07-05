/**
 * Referral code generation. Human-friendly, uppercase, no ambiguous chars.
 * Example: FFF-7K3QX9
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1

export function generateReferralCode(prefix = "FFF"): string {
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}
