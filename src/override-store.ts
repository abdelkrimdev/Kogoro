import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EntryType } from "./plugins/database/types";

export interface OverrideData {
  animeId?: string;
  episodeId?: string;
  entryType?: EntryType;
}

function tomlValue(value: string): string {
  return JSON.stringify(value);
}

export class OverrideStore {
  private dir: string;
  private filePath: string;
  private overrides: Map<string, OverrideData> = new Map();

  constructor(dir: string) {
    this.dir = dir;
    this.filePath = join(dir, "kogoro.toml");
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    const raw = readFileSync(this.filePath, "utf-8");
    const parsed = Bun.TOML.parse(raw) as {
      overrides?: Record<string, Record<string, unknown>>;
    };
    if (!parsed.overrides) return;
    for (const [hash, data] of Object.entries(parsed.overrides)) {
      this.overrides.set(hash, {
        animeId: data["anime-id"] as string | undefined,
        episodeId: data["episode-id"] as string | undefined,
        entryType: data["entry-type"] as EntryType | undefined,
      });
    }
  }

  private save(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    const lines: string[] = [];
    const entries = Array.from(this.overrides.entries());
    if (entries.length > 0) lines.push("[overrides]");
    for (const [hash, override] of entries) {
      const quotedHash = JSON.stringify(hash);
      if (override.animeId !== undefined) {
        lines.push(`${quotedHash}.anime-id = ${tomlValue(override.animeId)}`);
      }
      if (override.episodeId !== undefined) {
        lines.push(`${quotedHash}.episode-id = ${tomlValue(override.episodeId)}`);
      }
      if (override.entryType !== undefined) {
        lines.push(`${quotedHash}.entry-type = ${tomlValue(override.entryType)}`);
      }
    }
    const content = lines.length > 0 ? `${lines.join("\n")}\n` : "";
    writeFileSync(this.filePath, content);
  }

  get(hash: string): OverrideData | undefined {
    return this.overrides.get(hash);
  }

  set(hash: string, override: OverrideData): void {
    this.overrides.set(hash, override);
    this.save();
  }

  remove(hash: string): boolean {
    const existed = this.overrides.has(hash);
    this.overrides.delete(hash);
    if (existed) this.save();
    return existed;
  }

  list(): Array<{ hash: string; data: OverrideData }> {
    return Array.from(this.overrides.entries()).map(([hash, data]) => ({ hash, data }));
  }
}
