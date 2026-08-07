import { createRequire } from "node:module";
import type { Request, Response } from "express";

const reqFn = createRequire(import.meta.url);
const bundled = reqFn("../dist/index.cjs");
const app = bundled.default || bundled;
const routesReadyPromise = bundled.routesReadyPromise;

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
