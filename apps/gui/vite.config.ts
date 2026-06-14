import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname, "src/mainview"),
  base: "./",
  plugins: [
    tailwindcss(),
    svelte({
      compilerOptions: {
        runes: true,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist-webview"),
    emptyOutDir: true,
    assetsInlineLimit: (filePath) => {
      return filePath.endsWith(".woff") || filePath.endsWith(".woff2");
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/app.[ext]",
      },
    },
  },
  resolve: {
    conditions: ["browser"],
  },
});
