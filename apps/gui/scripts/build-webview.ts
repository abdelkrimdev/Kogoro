import { resolve } from "node:path";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");

if (process.env["VITE_DEV_SERVER_URL"]) {
  console.log("Vite dev server URL detected, skipping production webview build.");
  process.exit(0);
}

console.log("Building webview with Vite...");
await build({ configFile: resolve(root, "vite.config.ts") });
console.log("Webview build complete.");
