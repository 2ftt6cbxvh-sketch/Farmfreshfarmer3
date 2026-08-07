import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";

const app = express();

app.use((req, _res, next) => {
  express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  })(req, _res, next);
});
app.use(express.urlencoded({ extended: false }));

// Initialize routes lazily — done once per serverless instance
let routesRegistered = false;
let routesPromise: Promise<void> | null = null;

async function ensureRoutes() {
  if (routesRegistered) return;
  if (routesPromise) return routesPromise;
  routesPromise = (async () => {
    try {
      const { registerRoutes } = await import("../server/routes");
      const { createServer } = await import("node:http");
      const httpServer = createServer(app);
      await registerRoutes(httpServer, app);
      routesRegistered = true;
      console.log("[vercel] Routes registered successfully");
    } catch (e: any) {
      console.error("[vercel] Failed to register routes:", e?.message || e);
      routesPromise = null; // allow retry on next request
      throw e;
    }
  })();
  return routesPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    await ensureRoutes();
  } catch (e: any) {
    console.error("[vercel] handler: routes not ready:", e?.message || e);
    return res.status(503).json({ 
      error: "Service starting up, please retry",
      detail: e?.message || String(e)
    });
  }
  return app(req, res);
}
