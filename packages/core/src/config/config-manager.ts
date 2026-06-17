import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";
import {
  CONFIG_DIR,
  type Config,
  ConfigSchema,
  type EpisodeNumbering,
  type RenameAction,
  SCHEMA_DEFAULTS,
  TEMPLATE_PRESETS,
  type TypedConfig,
} from "./schema";

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
  const { template, plugins, sanitize, ...topLevel } = config;

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

  if (sanitize) {
    lines.push("");
    lines.push("[sanitize]");
    for (const [key, value] of Object.entries(sanitize)) {
      lines.push(`${key} = ${tomlValue(value)}`);
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

export type SetResult = { success: true } | { success: false; error: string };

function formatSchemaError(issues: readonly v.BaseIssue<unknown>[]): string {
  const issue = issues[0];
  if (!issue) return "Config validation failed";

  const path = issue.path?.map((p) => String(p.key)).join(".");
  const isUnknownKey = issue.path?.some((p) => p.origin === "key");

  if (isUnknownKey) {
    return `Unknown config key: '${path}'`;
  }

  if (issue.type === "picklist") {
    const rawExpected = (issue.expected ?? "").replace(/[()"]/g, "");
    const validValues = rawExpected.replace(/\s*\|\s*/g, ", ");
    const received = String(issue.received ?? issue.input).replace(/"/g, "'");
    return `Invalid value for '${path}': expected ${validValues}, received ${received}`;
  }

  const prefix = path ? `Invalid value for '${path}': ` : "";
  return `${prefix}${issue.message}`;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
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

  get primaryDb(): string {
    return this.config["primary-db"] as string;
  }

  get template(): { preset: string; custom: string; directory: string } {
    return this.config.template;
  }

  get scanConcurrency(): number {
    return this.config["scan-concurrency"];
  }

  get fetchConcurrency(): number {
    return this.config["fetch-concurrency"];
  }

  get episodeNumbering(): EpisodeNumbering {
    return this.config["episode-numbering"];
  }

  get renameAction(): RenameAction {
    return this.config["rename-action"];
  }

  get subtitleLanguage(): string {
    return this.config["subtitle-language"];
  }

  get mediaExtensions(): string[] {
    return this.config["media-extensions"];
  }

  get excludePatterns(): string[] {
    return this.config["exclude-patterns"];
  }

  get sanitize(): { action: string; replacement: string; chars: string } {
    return this.config.sanitize;
  }

  get plugins(): Record<string, { enabled: boolean }> {
    return this.config.plugins;
  }

  private load(): void {
    if (!existsSync(this.configPath)) return;
    const raw = readFileSync(this.configPath, "utf-8");
    let parsed: Record<string, unknown>;
    try {
      parsed = Bun.TOML.parse(raw) as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot parse config.toml: ${msg}`);
    }
    const result = v.safeParse(ConfigSchema, parsed);
    if (result.success) {
      this.config = result.output;
    } else {
      console.warn(`Config validation failed: ${formatSchemaError(result.issues)}, using defaults`);
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

  set<K extends keyof TypedConfig>(key: K, value: TypedConfig[K]): SetResult;
  set(key: string, value: string): SetResult;
  set(key: string, value: unknown): SetResult {
    const kebabKey = camelToKebab(key);
    const candidate = structuredClone(this.config) as Record<string, unknown>;
    const stringValue = typeof value === "string" ? value : String(value);
    const typedValue = coerceValue(kebabKey, stringValue);
    setNestedValue(candidate, kebabKey, typedValue);

    const result = v.safeParse(ConfigSchema, candidate);
    if (result.success) {
      this.config = result.output;
      this.save();
      return { success: true };
    }

    return { success: false, error: formatSchemaError(result.issues) };
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

  resolveMediaExtensions(): readonly string[] {
    const fromConfig = this.getList("media-extensions");
    if (fromConfig.length > 0) return fromConfig;
    return SCHEMA_DEFAULTS["media-extensions"];
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
