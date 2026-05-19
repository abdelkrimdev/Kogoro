import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ConfigManagerOptions {
  configDir?: string;
}

function tomlValue(value: unknown): string {
  if (typeof value === "string") {
    if (value.includes('"') || value.includes("\n")) {
      return JSON.stringify(value);
    }
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function tomlStringify(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    lines.push(`${key} = ${tomlValue(value)}`);
  }
  return `${lines.join("\n")}\n`;
}

export const TEMPLATE_PRESETS: Record<string, string> = {
  standard: "{anime} - {season}x{episode:02} - {title}",
  compact: "{anime} - E{episode:02}",
  absolute: "{anime} - {episode:03}",
  plex: "{anime} - s{season:02}e{episode:02} - {title}",
  anidb: "{anime} - {episode:03} - {title}",
};

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = flattenObject(value as Record<string, unknown>, fullKey);
      for (const [nk, nv] of Object.entries(nested)) {
        result[nk] = nv;
      }
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private data: Record<string, unknown> = {};

  constructor(options: ConfigManagerOptions = {}) {
    this.configDir = options.configDir ?? join(homedir(), ".config", "kogoro");
    this.configPath = join(this.configDir, "config.toml");
    this.load();
  }

  private load(): void {
    if (existsSync(this.configPath)) {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = Bun.TOML.parse(raw) as Record<string, unknown>;
      this.data = flattenObject(parsed);
    }
  }

  private save(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    const raw = tomlStringify(this.data);
    writeFileSync(this.configPath, raw);
  }

  get(key: string): string | undefined {
    const val = this.data[key];
    if (val === undefined) return undefined;
    return String(val);
  }

  getList(key: string): string[] {
    const val = this.get(key);
    if (!val || val.trim() === "") return [];
    return val
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  set(key: string, value: string): void {
    this.data[key] = value;
    this.save();
  }

  getTemplate(): string {
    const customString = this.get("template.string");
    if (customString && customString.length > 0) return customString;

    const preset = this.get("template.preset");
    if (preset && TEMPLATE_PRESETS[preset]) {
      return TEMPLATE_PRESETS[preset] as string;
    }

    return "{anime} - {season}x{episode:02} - {title}";
  }

  getDefaults(): Record<string, string> {
    return {
      "primary-db": "tvdb",
      "secondary-dbs": "",
      "template.preset": "standard",
      extensions: ".mkv,.mp4",
      "exclude-patterns": ".part,.crdownload",
      concurrency: "4",
      "api-delay": "200",
      "episode-numbering": "relative",
    };
  }

  init(): void {
    const defaults = this.getDefaults();
    for (const [key, value] of Object.entries(defaults)) {
      if (this.data[key] === undefined) {
        this.data[key] = value;
      }
    }
    this.save();
  }
}
