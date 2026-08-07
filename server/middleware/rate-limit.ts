/**
 * Rate limiting middleware for FarmFreshFarmer.
 * Uses express-rate-limit with in-memory store (suitable for single-instance Vercel).
 * For multi-instance deployments, swap windowMs store with Redis/Upstash.
 */
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/** Strict limiter for auth endpoints: 10 attempts per 15 minutes per IP */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  handler: (req: Request, res: Response) => {
    console.warn(`[rate-limit] Auth rate limit triggered for IP: ${req.ip}`);
    res.status(429).json({ message: "Too many login attempts. Please try again in 15 minutes." });
  },
});

/** General API limiter: 200 requests per minute per IP */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

/** OTP limiter: 3 OTP sends per 10 minutes per IP */
export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please wait 10 minutes." },
});
