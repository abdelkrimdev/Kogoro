export interface SanitizeConfig {
  action: "replace" | "strip";
  replacement: string;
  chars: string;
}

export function sanitizeFilename(value: string, config: SanitizeConfig): string {
  let result = value;
  for (const ch of config.chars) {
    if (config.action === "strip") {
      result = result.replaceAll(ch, "");
    } else {
      result = result.replaceAll(ch, config.replacement);
    }
  }
  return result.replace(/[\s.]+$/g, "");
}
