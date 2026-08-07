import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/register-routes";

const app = express();

app.use(
  express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

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
    console.error("[vercel] handler error:", e?.message || e);
    return res.status(503).json({
      error: "Service starting up, please retry",
      detail: e?.message || String(e),
    });
  }
  return app(req, res);
}
