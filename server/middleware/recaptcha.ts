import type { Request, Response, NextFunction } from "express";

/**
 * Validates Google reCAPTCHA v3 / Enterprise token against Google siteverify API.
 * In development or when RECAPTCHA_SECRET_KEY is not configured, it passes through gracefully.
 */
export async function requireRecaptcha(req: Request, res: Response, next: NextFunction) {
  const secretKey =
    process.env.RECAPTCHA_SECRET_KEY ||
    process.env.GOOGLE_RECAPTCHA_SECRET_KEY ||
    "6Lc5e50tAAAAAFNK2XaEur30t-ebmkoh78DCv8jm";
  if (!secretKey) {
    return next();
  }

  const token = req.body?.recaptchaToken || req.headers["x-recaptcha-token"];
  if (!token) {
    return res.status(400).json({
      message: "reCAPTCHA security check failed: missing token. Please refresh the page.",
    });
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: String(token),
      remoteip: req.ip || "",
    });

    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.success || (typeof verifyData.score === "number" && verifyData.score < 0.3)) {
      console.warn(`[reCAPTCHA Blocked] IP: ${req.ip} Score: ${verifyData.score} Errors:`, verifyData["error-codes"]);
      return res.status(403).json({
        message: "Automated bot traffic detected by Google reCAPTCHA. Please try again.",
      });
    }

    return next();
  } catch (err: any) {
    console.error("[reCAPTCHA API Error]:", err?.message);
    return next();
  }
}
