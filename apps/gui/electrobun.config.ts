import type { ElectrobunConfig } from "electrobun";
import { version } from "./package.json";

export default {
  app: {
    name: "Kogoro",
    identifier: "dev.kogoro.gui",
    version,
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
      define: {
        "process.env.VITE_DEV_SERVER_URL": JSON.stringify(process.env["VITE_DEV_SERVER_URL"] ?? ""),
      },
    },
    // linux: { bundleCEF: true },
  },
  release: {
    baseUrl:
      process.env["RELEASE_BASE_URL"] ??
      "https://github.com/abdelkrimdev/kogoro/releases/download/",
  },
  scripts: {
    preBuild: "scripts/build-webview.ts",
    postBuild: "scripts/copy-webview.ts",
  },
} satisfies ElectrobunConfig;
