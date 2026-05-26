import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";
import { CONFIG_DIR, type Config, ConfigSchema, TEMPLATE_PRESETS } from "./schema";

interface ConfigManagerOptions {
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
  if (Array.isArray(value)) {
    const items = value.map((item) => tomlValue(item));
    return `[${items.join(", ")}]`;
  }
  return JSON.stringify(value);
}

function tomlStringify(config: Config): string {
  const lines: string[] = [];
  const { template, plugins, ...topLevel } = config;

  for (const [key, value] of Object.entries(topLevel)) {
    lines.push(`${key} = ${tomlValue(value)}`);
  }

  if (template) {
    lines.push("");
    lines.push("[template]");
    for (const [key, value] of Object.entries(template)) {
      lines.push(`${key} = ${tomlValue(value)}`);
    }
  }

  if (plugins) {
    for (const [name, toggle] of Object.entries(plugins)) {
      lines.push("");
      lines.push(`[plugins.${name}]`);
      lines.push(`enabled = ${tomlValue(toggle.enabled)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    current[lastPart] = value;
  }
}

function coerceValue(key: string, value: string): unknown {
  if (key.endsWith(".enabled")) {
    return value.toLowerCase() === "true";
  }
  if (key === "scan-concurrency" || key === "fetch-concurrency") {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  if (key === "media-extensions" || key === "exclude-patterns") {
    if (value.includes(",")) {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (value.trim()) {
      return [value.trim()];
    }
    return [];
  }
  if (key === "template.preset" && value === "") {
    return "standard";
  }
  return value;
}

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private config: Config;

  constructor(options: ConfigManagerOptions = {}) {
    this.configDir = options.configDir ?? CONFIG_DIR;
    this.configPath = join(this.configDir, "config.toml");
    this.config = v.parse(ConfigSchema, {});
    this.load();
  }

  private load(): void {
    if (!existsSync(this.configPath)) return;
    const raw = readFileSync(this.configPath, "utf-8");
    try {
      const parsed = Bun.TOML.parse(raw) as Record<string, unknown>;
      const result = v.safeParse(ConfigSchema, parsed);
      if (result.success) {
        this.config = result.output;
      }
    } catch {
      // Invalid TOML, use defaults
    }
  }

  private save(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    const raw = tomlStringify(this.config);
    writeFileSync(this.configPath, raw);
  }

  get(key: string): unknown {
    return getNestedValue(this.config, key);
  }

  getList(key: string): string[] {
    const val = this.get(key);
    if (Array.isArray(val)) return val.map((s) => String(s));
    if (typeof val === "string" && val.trim() !== "") {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return [];
  }

  set(key: string, value: string): void {
    const candidate = structuredClone(this.config) as Record<string, unknown>;
    const typedValue = coerceValue(key, value);
    setNestedValue(candidate, key, typedValue);

    const result = v.safeParse(ConfigSchema, candidate);
    if (result.success) {
      this.config = result.output;
      this.save();
    }
  }

  isPluginEnabled(name: string): boolean {
    const plugins = this.config.plugins;
    const plugin = plugins?.[name as keyof typeof plugins];
    if (plugin === undefined) return true;
    return plugin.enabled;
  }

  getDisabledPlugins(): Set<string> {
    const disabled = new Set<string>();
    const plugins = this.config.plugins;
    if (!plugins) return disabled;
    for (const [name, toggle] of Object.entries(plugins)) {
      if (!toggle.enabled) {
        disabled.add(name);
      }
    }
    return disabled;
  }

  getTemplate(): string {
    const templateConfig = this.config.template;
    if (templateConfig.custom) return templateConfig.custom;
    const preset = templateConfig.preset;
    const template = TEMPLATE_PRESETS[preset as keyof typeof TEMPLATE_PRESETS];
    if (template) return template;
    return TEMPLATE_PRESETS.standard;
  }

  init(): void {
    this.save();
  }
}
