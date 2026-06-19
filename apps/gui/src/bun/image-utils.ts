import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function toDataUrl(filePath: string): Promise<string | undefined> {
  try {
    const buf = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] ?? "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}
