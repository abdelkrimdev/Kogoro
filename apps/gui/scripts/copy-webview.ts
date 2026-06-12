import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(root, "../..");
const distDir = resolve(root, "dist-webview");
const drizzleDir = resolve(workspaceRoot, "packages/core/drizzle");

const buildDir = process.env["ELECTROBUN_BUILD_DIR"];
const appName = process.env["ELECTROBUN_APP_NAME"];
if (!buildDir) {
  console.log("ELECTROBUN_BUILD_DIR not set, skipping webview copy");
  process.exit(0);
}

if (existsSync(distDir)) {
  const targetDir = resolve(buildDir, "app/views/mainview");
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(distDir)) {
    cpSync(resolve(distDir, entry), resolve(targetDir, entry), { recursive: true });
  }
  console.log(`Copied webview output to ${targetDir}`);
} else {
  console.log("Vite output not found, skipping webview copy (dev mode)");
}

if (existsSync(drizzleDir)) {
  const resourcesDir = appName ? join(buildDir, appName, "Resources") : buildDir;
  const targetDir = resolve(resourcesDir, "drizzle");
  mkdirSync(targetDir, { recursive: true });
  cpSync(drizzleDir, targetDir, { recursive: true });
  console.log(`Copied drizzle migrations to ${targetDir}`);
} else {
  console.log("Drizzle migrations not found, skipping copy");
}
