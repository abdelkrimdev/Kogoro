import { statSync } from "node:fs";
import type { DatabasePlugin } from "../database/types.ts";
import { Scanner } from "../scanner.ts";

export interface ScanHandlerOptions {
  database: DatabasePlugin;
  extensions?: string[];
}

export function createScanHandlers(options: ScanHandlerOptions) {
  const scanner = new Scanner({ database: options.database });
  const extensions = options.extensions ?? [".mkv", ".mp4", ".avi", ".mov"];

  return {
    async scan(path: string): Promise<string> {
      const isDir = statSync(path).isDirectory();
      const results = isDir
        ? await scanner.scanDir(path, extensions)
        : [await scanner.scanFile(path)];

      return JSON.stringify(results, null, 2);
    },
  };
}
