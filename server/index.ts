import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { createServer } from "node:http";
import { registerRoutes } from "./register-routes";
import { serveStatic } from "./static";
import { runAutoMigrations } from "./db";

// Only used for local development server (not Vercel)
export const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ limit: "50mb", extended: true }));

function sanitizeInput(obj: any): any {
  if (!obj || typeof obj !== "object") {
    if (typeof obj === "string") {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript\s*:/gi, "blocked:")
        .replace(/vbscript\s*:/gi, "blocked:")
        .replace(/data:text\/html/gi, "blocked:");
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    clean[k] = sanitizeInput(v);
  }
  return clean;
}

// Global Anti-Injection & XSS Protection Middleware
app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  next();
});

// Strict Production Security Headers & Content Security Policy (CSP)
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://*.gstatic.com https://www.google.com https://www.gstatic.com/recaptcha/ https://www.google.com/recaptcha/ https://*.firebaseapp.com https://*.firebaseio.com https://checkout.razorpay.com https://*.razorpay.com https://*.phonepe.com https://challenges.cloudflare.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: res.cloudinary.com https://images.unsplash.com https://*.googleusercontent.com https://lh3.googleusercontent.com",
    "connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.google.com/recaptcha/ https://api.phonepe.com https://mercury-t2.phonepe.com https://api.razorpay.com https://api.ipify.org http://ip-api.com https://api.telegram.org wss: ws:",
    "frame-src 'self' https://accounts.google.com https://www.google.com/recaptcha/ https://recaptcha.google.com https://*.firebaseapp.com https://api.phonepe.com https://mercury-t2.phonepe.com https://api.razorpay.com https://challenges.cloudflare.com",
    "frame-ancestors 'self'",
    "form-action 'self' https://api.phonepe.com https://mercury-t2.phonepe.com https://api.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;  
      }
      log(logLine);
    }
  });

  next();
});

export const routesReadyPromise = (async () => {
  await runAutoMigrations();
  await registerRoutes(httpServer, app);

  // Send Telegram deploy/update alert to Super Admins on server boot
  try {
    const { notifyDeploymentIfNewVersion } = await import("./services/telegram");
    notifyDeploymentIfNewVersion("v10.0.0").catch(() => {});
  } catch {}

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  if (process.env.VERCEL !== "1") {
    const port = parseInt(process.env.PORT || "5001", 10);
    httpServer.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port} (http://localhost:${port})`);
    });
  }
})();

export default app;
