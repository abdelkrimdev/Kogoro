import { statSync } from "node:fs";
import type { ScanStateEntry, ScanStateRepository } from "./scan-state-repository";

export class ScanStateService {
  constructor(private repo: ScanStateRepository) {}

  get(path: string): ScanStateEntry | null {
    return this.repo.get(path);
  }

  getBatch(paths: string[]): Map<string, ScanStateEntry> {
    return this.repo.getBatch(paths);
  }

  set(path: string, size: number, mtime: number, hash: string): void {
    this.repo.set(path, size, mtime, hash);
  }

  setFromFs(path: string, hash: string): void {
    const stat = statSync(path);
    this.repo.set(path, stat.size, Math.floor(stat.mtimeMs / 1000), hash);
  }

  moveRename(oldPath: string, newPath: string, hash: string): void {
    this.repo.delete(oldPath);
    this.setFromFs(newPath, hash);
  }

  delete(path: string): void {
    this.repo.delete(path);
  }

  isFileUpToDate(path: string, size: number, mtime: number): string | null {
    const entry = this.repo.get(path);
    if (!entry) return null;
    if (entry.size !== size || entry.mtime !== mtime) return null;
    return entry.hash;
  }
}
