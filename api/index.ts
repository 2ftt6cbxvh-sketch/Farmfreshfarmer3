import "dotenv/config";
import type { Request, Response } from "express";

const { default: app, routesReadyPromise } = require("../dist/index.cjs");

let isReady = false;

export default async function handler(req: Request, res: Response) {
  try {
    if (!isReady && routesReadyPromise) {
      await routesReadyPromise;
      isReady = true;
    }
  } catch (e: any) {
    console.error("[vercel] handler error:", e?.message || e);
    return res.status(503).json({
      error: "Service starting up, please retry",
      detail: e?.message || String(e),
    });
  }
  return app(req, res);
}
