import { SCHEMA_DEFAULTS } from "../config/schema";

export interface PreprocessedData {
  name: string;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function stripCorruptedExtensions(name: string, extensions: readonly string[]): string {
  const exts = extensions.map((e) => e.replace(/^\./, "")).join("|");
  const videoEx = new RegExp(`\\.(${exts})$`, "i");
  const corruptPat = new RegExp(`\\.(${exts})\\]$`, "i");
  let current = name;
  while (true) {
    const trimmed = current.trim();
    if (trimmed.endsWith("]")) {
      const corrupt = corruptPat.exec(trimmed);
      if (corrupt) {
        current = trimmed.slice(0, -1).trim();
        continue;
      }
    }
    if (videoEx.test(trimmed)) {
      current = stripExtension(trimmed);
      continue;
    }
    break;
  }
  return current;
}

function normalizeName(name: string): string {
  let result = name.trim();
  if (/^[^[\]]+\s*\]/.test(result) && !result.startsWith("[")) {
    result = `[${result}`;
  }
  return result.replace(/_/g, " ").trim();
}

function replaceDotsWithSpaces(dotted: string): string {
  let result = dotted.replace(/(?<=\d)\.(?=\d\b)/g, "_DEC_");
  result = result.replace(/\b(h)\.(264|265)\b/gi, "$1_ENC_$2");
  result = result.replace(
    /\b([a-zA-Z0-9_-]+)\.(pw|biz|com|net|org|io|me|info|tv)\b/gi,
    "$1_DOT_$2",
  );
  result = result.replace(/\./g, " ");
  result = result.replace(/_DEC_/g, ".");
  result = result.replace(/_ENC_/g, ".");
  result = result.replace(/_DOT_/g, ".");
  return result;
}

function normalizeDots(name: string): string {
  if (name.includes(" ")) return name;
  return replaceDotsWithSpaces(name);
}

export function preprocess(filename: string, extensions?: readonly string[]): PreprocessedData {
  const exts = extensions ?? SCHEMA_DEFAULTS["media-extensions"];
  let name = stripExtension(filename);
  name = stripCorruptedExtensions(name, exts);
  name = normalizeName(name);
  name = normalizeDots(name);
  return { name };
}
