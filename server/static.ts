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

  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html") || filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  }));

  // Fall through to index.html for client-side SPA routes ONLY
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/health")) {
      return next();
    }

    // Do NOT serve index.html for missing asset or static file requests
    if (req.path.startsWith("/assets/") || /\.(js|mjs|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map|json)$/i.test(req.path)) {
      return res.status(404).type("text/plain").send("Asset not found");
    }

    // Async non-blocking Telegram security bot notification for website visitor
    import("./services/telegram")
      .then(({ notifyWebsiteVisitor }) => notifyWebsiteVisitor(req))
      .catch(() => {});

    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || req.hostname || "";
      const adminSubdomain = (process.env.ADMIN_SUBDOMAIN || "").toLowerCase().trim();
      const isAdminHost = Boolean(adminSubdomain && host.toLowerCase().includes(adminSubdomain));

      try {
        let html = fs.readFileSync(indexPath, "utf8");
        const injectScript = `<script>window.__IS_ADMIN_HOST__ = ${isAdminHost};</script>`;
        html = html.replace("<head>", `<head>${injectScript}`);
        return res.send(html);
      } catch {
        return res.sendFile(indexPath);
      }
    }
    next();
  });
}
