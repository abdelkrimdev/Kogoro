import { readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  const resolvedBase = resolve(baseDir);
  for (const dir of sourceDirs) {
    let current = resolve(dir);
    while (current !== resolvedBase && current.startsWith(`${resolvedBase}/`)) {
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
