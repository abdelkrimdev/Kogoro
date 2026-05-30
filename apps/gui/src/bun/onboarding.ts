import { existsSync } from "node:fs";
import { join } from "node:path";

export function shouldShowOnboarding(configDir: string): boolean {
  const configPath = join(configDir, "config.toml");
  return !existsSync(configPath);
}
