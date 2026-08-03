// Copies @esri/calcite-components' asset directory (icons, t9n messages,
// etc.) into public/assets so they're served from the app's own origin
// instead of relying on a CDN setAssetPath, which may be blocked on a
// corporate network. Runs on both postinstall and prebuild so it works
// identically locally and in CI.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const src = join(
  projectRoot,
  "node_modules",
  "@esri",
  "calcite-components",
  "dist",
  "calcite",
  "assets"
);
const dest = join(projectRoot, "public", "assets");

if (!existsSync(src)) {
  console.warn(
    `[copy-calcite-assets] source not found at ${src} — skipping (run after npm install).`
  );
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-calcite-assets] copied Calcite assets -> ${dest}`);
