import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "./schema";

export interface DbPaths {
  libraryDbPath: string;
  cacheDbPath: string;
}

export function resolveDbPaths(configDir: string = CONFIG_DIR): DbPaths {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  return {
    libraryDbPath: join(configDir, "library.db"),
    cacheDbPath: join(configDir, "cache.db"),
  };
}
