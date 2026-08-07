import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { createServer } from "node:http";
// Static import so Vercel's ncc bundler includes server/routes.ts in the bundle.
// Dynamic imports of server/routes fail because /var/task/server/routes resolves
// to the routes/ directory at runtime instead of the routes.ts file.
import { registerRoutes } from "../server/routes";

const app = express();

app.use(
  express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Lazy route registration — runs once per warm serverless instance
let routesRegistered = false;
let routesPromise: Promise<void> | null = null;

async function ensureRoutes(): Promise<void> {
  if (routesRegistered) return;
  if (routesPromise) return routesPromise;

  routesPromise = (async () => {
    try {
      const httpServer = createServer(app);
      await registerRoutes(httpServer, app);
      routesRegistered = true;
      console.log("[vercel] Routes registered successfully");
    } catch (e: any) {
      console.error("[vercel] Failed to register routes:", e?.message || e);
      routesPromise = null;
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
      detail: e?.message || String(e),
    });
  }
  return app(req, res);
}
