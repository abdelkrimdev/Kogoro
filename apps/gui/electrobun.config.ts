import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Kogoro",
    identifier: "dev.kogoro.gui",
    version: "0.1.0",
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
  },
  scripts: {
    preBuild: "scripts/build-webview.ts",
    postBuild: "scripts/copy-webview.ts",
  },
} satisfies ElectrobunConfig;
