import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const distDir = resolve(root, "dist-webview");

const buildDir = process.env["ELECTROBUN_BUILD_DIR"];
if (!buildDir) {
  console.log("ELECTROBUN_BUILD_DIR not set, skipping webview copy");
  process.exit(0);
}

if (!existsSync(distDir)) {
  console.log("Vite output not found, skipping webview copy (dev mode)");
  process.exit(0);
}

const targetDir = resolve(buildDir, "app/views/mainview");

mkdirSync(targetDir, { recursive: true });

for (const entry of readdirSync(distDir)) {
  cpSync(resolve(distDir, entry), resolve(targetDir, entry), { recursive: true });
}

console.log(`Copied webview output to ${targetDir}`);
