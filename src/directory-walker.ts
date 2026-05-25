import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

export const VIDEO_EXTENSIONS = [".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"];

interface WalkOptions {
  excludePatterns?: string[];
}

export function walk(dir: string, extensions: string[], options?: WalkOptions): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, extensions, options));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!extensions.includes(ext)) continue;
      if (options?.excludePatterns?.some((p) => entry.name.includes(p))) continue;
      results.push(fullPath);
    }
  }
  return results;
}
