/**
 * JWT token service for FarmFreshFarmer.
 * Handles access token + refresh token issuance, verification, and DB storage.
 * Runs in PARALLEL with the existing express-session auth (backward compatible).
 */
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db";
import { refreshTokens, users } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "farmfreshfarmer-jwt-dev-secret-change-in-production";
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "30d";
const REFRESH_EXPIRES_IN_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || "90", 10);

export interface JwtPayload {
  userId: number;
  role: string;
  platform?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/** Issue a new access + refresh token pair and persist the refresh token in DB. */
export async function issueTokenPair(
  userId: number,
  role: string,
  opts: {
    platform?: string;
    deviceId?: string;
    ip?: string;
    userAgent?: string;
  } = {}
): Promise<TokenPair> {
  const payload: JwtPayload = { userId, role, platform: opts.platform || "web" };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN as any,
  });

  // Generate a cryptographically random refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString("hex");
  const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_IN_DAYS);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    deviceId: opts.deviceId,
    platform: opts.platform || "web",
    ipAtIssue: opts.ip,
    userAgent: opts.userAgent,
    expiresAt,
  });

  // Return raw token to client (only ever sent once)
  const combined = `${userId}.${rawRefreshToken}`;
  const accessExpiryMs = parseExpiry(ACCESS_EXPIRES_IN);

  return {
    accessToken,
    refreshToken: combined,
    expiresIn: Math.floor(accessExpiryMs / 1000),
  };
}

/** Verify an access token. Returns payload or throws. */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Validate a refresh token string, rotate it (issue new pair), and revoke the old one.
 * Returns null if the token is invalid/expired/revoked.
 */
export async function rotateRefreshToken(
  combinedToken: string,
  opts: { ip?: string; userAgent?: string } = {}
): Promise<TokenPair | null> {
  const dotIdx = combinedToken.indexOf(".");
  if (dotIdx === -1) return null;
  const userId = parseInt(combinedToken.slice(0, dotIdx), 10);
  const rawToken = combinedToken.slice(dotIdx + 1);

  if (isNaN(userId)) return null;

  // Find active, non-expired, non-revoked tokens for this user
  const tokens = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      )
    )
    .limit(20);

  // Find the matching token by comparing bcrypt hash
  let matchedToken: (typeof tokens)[0] | null = null;
  for (const t of tokens) {
    const match = await bcrypt.compare(rawToken, t.tokenHash);
    if (match) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken) return null;

  // Revoke the old token
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, matchedToken.id));

  // Look up the user's role from DB
  const [user] = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  if (!user || user.status === "blocked") return null;

  // Issue new pair
  return issueTokenPair(userId, user.role, {
    platform: matchedToken.platform || "web",
    deviceId: matchedToken.deviceId || undefined,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
}

/** Revoke a specific refresh token by its DB id. */
export async function revokeRefreshToken(tokenId: number): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenId));
}

/** Revoke all refresh tokens for a user (force logout everywhere). */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

// Helper: parse expiry string like "15m", "2h", "30d" to milliseconds
function parseExpiry(expiry: string): number {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 3600 * 1000;
    case "d": return value * 86400 * 1000;
    default: return 900 * 1000; // 15m default
  }
}
