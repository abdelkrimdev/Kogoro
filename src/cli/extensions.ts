import type { ConfigManager } from "../config/config-manager";
import { SCHEMA_DEFAULTS } from "../config/schema";

export function resolveMediaExtensions(config?: ConfigManager): readonly string[] {
  return config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
}
