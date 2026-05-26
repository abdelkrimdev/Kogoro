import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EntryType } from "./plugins/database/types";

export const OVERRIDE_TOML_KEYS = {
  ANIME_ID: "anime-id",
  EPISODE_ID: "episode-id",
  ENTRY_TYPE: "entry-type",
} as const;

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
        animeId: data[OVERRIDE_TOML_KEYS.ANIME_ID] as string | undefined,
        episodeId: data[OVERRIDE_TOML_KEYS.EPISODE_ID] as string | undefined,
        entryType: data[OVERRIDE_TOML_KEYS.ENTRY_TYPE] as EntryType | undefined,
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
        lines.push(`${quotedHash}.${OVERRIDE_TOML_KEYS.ANIME_ID} = ${tomlValue(override.animeId)}`);
      }
      if (override.episodeId !== undefined) {
        lines.push(
          `${quotedHash}.${OVERRIDE_TOML_KEYS.EPISODE_ID} = ${tomlValue(override.episodeId)}`,
        );
      }
      if (override.entryType !== undefined) {
        lines.push(
          `${quotedHash}.${OVERRIDE_TOML_KEYS.ENTRY_TYPE} = ${tomlValue(override.entryType)}`,
        );
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
