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
    console.error("[vercel] handler boot error:", e?.message || e);
    isReady = false;
    return res.status(503).json({
      error: "Service initializing, please retry in a moment",
      detail: e?.message || String(e),
    });
  }
  return app(req, res);
}
