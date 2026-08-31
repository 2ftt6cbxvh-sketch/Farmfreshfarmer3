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

/** Chatbot message rate limiter: 30 requests per minute per IP to prevent AI quota exhaustion */
export const chatbotMessageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { reply: "🙏 You are sending messages a bit too quickly. Please wait a few seconds before asking your next question!", needsHuman: false },
});

/** Chatbot human escalation rate limiter: 5 requests per 10 minutes per IP to prevent alert spam */
export const chatbotEscalationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many human support escalation requests. Our team is already notified! Please wait a moment." },
});
