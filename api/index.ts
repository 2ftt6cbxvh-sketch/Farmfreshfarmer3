import type { Request, Response } from "express";

// Import the pre-bundled app and initialization promise
// We use require to ensure it correctly resolves the CJS bundle
const { default: app, routesReadyPromise } = require("../dist/index.cjs");

let isReady = false;

export default async function handler(req: Request, res: Response) {
  try {
    if (!isReady && routesReadyPromise) {
      await routesReadyPromise;
      isReady = true;
      console.log("[vercel] Routes registered successfully from bundle");
    }
  } catch (e: any) {
    console.error("[vercel] handler: routes not ready:", e?.message || e);
    return res.status(503).json({
      error: "Service starting up, please retry",
      detail: e?.message || String(e),
    });
  }
  return app(req, res);
}
