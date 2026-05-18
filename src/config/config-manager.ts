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
      this.data = Bun.TOML.parse(raw) as Record<string, unknown>;
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

  set(key: string, value: string): void {
    this.data[key] = value;
    this.save();
  }

  getDefaults(): Record<string, string> {
    return {
      "primary-db": "tvdb",
      "template.string": "{anime} - {season}x{episode:02} - {title}",
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
