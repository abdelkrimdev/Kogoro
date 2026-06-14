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
    copy: {
      "dist-webview/index.html": "views/mainview/index.html",
      "dist-webview/assets/app.js": "views/mainview/assets/app.js",
      "dist-webview/assets/app.css": "views/mainview/assets/app.css",
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
  },
} satisfies ElectrobunConfig;
