import { type ConfigManager, SCHEMA_DEFAULTS } from "@kogoro/core";

export function resolveMediaExtensions(config?: ConfigManager): readonly string[] {
  return config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
}
