import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const possiblePaths = [
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(__dirname, "public"),
    path.resolve(__dirname, "../public"),
    path.resolve(process.cwd(), "public"),
  ];

  let distPath = possiblePaths.find((p) => fs.existsSync(p)) || path.resolve(process.cwd(), "dist/public");

  app.use(express.static(distPath));

  // fall through to index.html for all client-side SPA routes
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/health")) {
      return next();
    }
    // Async non-blocking Telegram security bot notification for website visitor
    import("./services/telegram")
      .then(({ notifyWebsiteVisitor }) => notifyWebsiteVisitor(req))
      .catch(() => {});

    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}
