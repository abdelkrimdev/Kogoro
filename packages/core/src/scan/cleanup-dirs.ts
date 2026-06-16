import { readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

function hasOnlyHiddenFiles(dir: string): boolean {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.every((entry) => entry.name.startsWith(".") && !entry.isDirectory());
  } catch {
    return false;
  }
}

function removeDirContents(dir: string): void {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    unlinkSync(join(dir, entry));
  }
}

export function cleanupEmptyDirs(sourceDirs: Set<string>, baseDir: string): void {
  for (const dir of sourceDirs) {
    let current = dir;
    while (current !== baseDir && current.startsWith(baseDir)) {
      if (hasOnlyHiddenFiles(current)) {
        removeDirContents(current);
        rmdirSync(current);
        current = dirname(current);
      } else {
        break;
      }
    }
  }
}
