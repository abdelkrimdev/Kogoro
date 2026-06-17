import type { Config } from "./schema";

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

export function tomlStringify(config: Config): string {
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
