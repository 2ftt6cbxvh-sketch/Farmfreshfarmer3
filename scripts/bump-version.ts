/**
 * Build & deploy version bumper.
 * Auto-increments patch version in package.json.
 */
import fs from "fs";
import path from "path";

const pkgPath = path.resolve(process.cwd(), "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const parts = (pkg.version || "1.0.0").split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  pkg.version = parts.join(".");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`[version bump] New version: v${pkg.version}`);
}
