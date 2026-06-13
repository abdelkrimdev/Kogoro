import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");

const vite = await createServer({
  configFile: resolve(root, "vite.config.ts"),
});

await vite.listen();
vite.printUrls();

const serverUrl = vite.resolvedUrls?.local?.[0] ?? "http://localhost:5173";

const ebun = spawn("electrobun", ["dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, VITE_DEV_SERVER_URL: serverUrl },
});

ebun.on("exit", (code) => {
  vite.close();
  process.exit(code ?? 0);
});

const cleanup = () => {
  ebun.kill();
  vite.close();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
