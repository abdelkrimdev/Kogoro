import type { ParsedTags } from "./parser";

const SCENE_GROUP_PAT = /(?<!\s)-(?<group>[a-zA-Z0-9_.-]+)$/;
const CRC_PAT = /[0-9A-Fa-f]{8}/;

const RESOLUTION_RE = /^(\d+p?)$/i;
const DIMENSION_RE = /^(\d+x\d+p?)$/i;
const CODEC_SET = new Set([
  "x265",
  "x264",
  "h265",
  "h264",
  "hevc",
  "av1",
  "vp9",
  "divx",
  "xvid",
  "avc",
]);
const AUDIO_SET = new Set(["aac", "flac", "mp3", "opus", "ac3", "dts", "ddp51", "dd51", "ddp"]);
const SOURCE_SET = new Set([
  "bluray",
  "bdrip",
  "bd",
  "webdl",
  "webrip",
  "web",
  "hdtv",
  "dvd",
  "dvdrip",
  "ld",
]);

const TAG_DISCARD_RE =
  /^(1080p(?:mini)?|720p(?:mini)?|480p|2160p|576p|x264|x265|h\.?264|h\.?265|hevc|av1|vp9|avc|divx|xvid|10bit|10-bit|8bit|hi10|hi10p|bluray|bdrip|bd|web-dl|webrip|web|hdtv|dvd|dvdrip|ld|aac|flac|mp3|opus|ac3|dts|ddp5\.1|dd5\.1|ddp51|dd51|ddp|dd|v\d+|end|final|multi|weekly|dual|audio|nf|netflix|cr|crunchyroll|fun|funimation|amzn|amazon)$/i;
const DIMENSION_DISCARD_RE = /^\d+x\d+p?$/i;
const NUMBER_DISCARD_RE = /^\d+(?:\.\d+)?$/i;

function normalizeTag(token: string): string {
  return token.replace(/\./g, "").replace(/-/g, "").toLowerCase();
}

function parseResolution(token: string): string | null {
  if (DIMENSION_RE.test(token)) return token;
  const m = RESOLUTION_RE.exec(token);
  if (m?.[1]) {
    const num = parseInt(m[1], 10);
    if (num >= 480 && num <= 2160) {
      return /p$/i.test(token) ? token : `${token}p`;
    }
  }
  return null;
}

function parseCodec(token: string): string | null {
  const normalized = normalizeTag(token);
  return CODEC_SET.has(normalized) ? normalized : null;
}

function parseAudio(token: string): string | null {
  if (/^DDP5\.1$/i.test(token)) return "ddp5.1";
  if (/^DD5\.1$/i.test(token)) return "dd5.1";
  const normalized = normalizeTag(token);
  return AUDIO_SET.has(normalized) ? normalized : null;
}

function parseSource(token: string): string | null {
  const normalized = normalizeTag(token);
  if (normalized === "webdl") return "web-dl";
  return SOURCE_SET.has(normalized) ? normalized : null;
}

function extractBracketContents(name: string): string[] {
  const contents: string[] = [];
  const pattern = /[[(]([^\])]+)[\])]/g;
  let match = pattern.exec(name);
  while (match !== null) {
    if (match[1]) {
      contents.push(match[1].trim());
    }
    match = pattern.exec(name);
  }
  return contents;
}

function getLeadingGroup(name: string): string | null {
  if (!name.startsWith("[")) return null;
  const m = /^\[([^\]]+)\]/.exec(name);
  return m?.[1] ? m[1].trim() : null;
}

function getTrailingGroup(name: string): string | null {
  if (!name.endsWith("]")) return null;
  const m = /\[([^\]]+)\]$/.exec(name);
  if (!m?.[1]) return null;
  const content = m[1].trim();
  if (hasOnlyTags(content)) return null;
  if (CRC_PAT.test(content) && content.length === 8) return null;
  return content;
}

function hasOnlyTags(content: string): boolean {
  const tokens = content.trim().split(/[\s._,(-]+/);
  return tokens.every((token) => {
    const clean = token.trim().replace(/^-|-$/g, "");
    if (!clean) return true;
    return (
      TAG_DISCARD_RE.test(clean) ||
      DIMENSION_DISCARD_RE.test(clean) ||
      NUMBER_DISCARD_RE.test(clean)
    );
  });
}

function extractTagsFromBrackets(name: string): ParsedTags {
  let group: string | null = getLeadingGroup(name);
  let resolution: string | null = null;
  let codec: string | null = null;
  let source: string | null = null;
  let audio: string | null = null;

  for (const content of extractBracketContents(name)) {
    for (const token of content.split(/[\s._,-]+/)) {
      if (!token) continue;
      resolution = parseResolution(token) ?? resolution;
      codec = parseCodec(token) ?? codec;
      audio = parseAudio(token) ?? audio;
      source = parseSource(token) ?? source;
    }
  }

  if (!group) {
    group = getTrailingGroup(name);
  }

  return { group, resolution, codec, source, audio };
}

function extractTagsFromTokens(name: string, existing: ParsedTags): ParsedTags {
  let { group, resolution, codec, source, audio } = existing;

  for (const raw of name.split(/[\s()[\]]+/)) {
    const token = raw.trim().replace(/^-|-$/g, "");
    if (!token) continue;

    const resMatch = token.match(/(\d+p)/i);
    if (resMatch?.[1]) {
      const parsed = parseResolution(resMatch[1]);
      if (parsed) resolution = parsed;
    }

    const parsedRes = parseResolution(token);
    if (parsedRes) resolution = parsedRes;

    const codecRe = /\b(x265|x264|h\.?265|h\.?264|hevc|av1|vp9|divx|xvid|avc)\b/gi;
    const m = codecRe.exec(token);
    if (m?.[1]) {
      const parsed = parseCodec(m[1]);
      if (parsed) codec = parsed;
    }

    const sourceRe = /\b(bluray|bdrip|bd|web-dl|webrip|web|hdtv|dvd|dvdrip|webdl|ld)\b/gi;
    const s = sourceRe.exec(token);
    if (s?.[1]) {
      const parsed = parseSource(s[1]);
      if (parsed) source = parsed;
    }

    const audioRe = /\b(aac|flac|mp3|opus|ac3|dts|ddp5\.1|dd5\.1|ddp|ddp51|dd51)\b/gi;
    const a = audioRe.exec(token);
    if (a?.[1]) {
      const parsed = parseAudio(a[1]);
      if (parsed) audio = parsed;
    }
  }

  return { group, resolution, codec, source, audio };
}

function cleanMetaTokens(name: string): string {
  let result = name.replace(/\[[^\]]+\]/g, (match) => {
    const inner = match.slice(1, -1).trim();
    if (/^\d{4}$/.test(inner)) {
      const year = parseInt(inner, 10);
      if (year >= 1900 && year <= 2100) return match;
    }
    return "";
  });

  result = result.replace(/\(([^)]+)\)/g, (match, content: string) => {
    if (/^\d{4}$/.test(content.trim())) return match;
    return hasOnlyTags(content) ? "" : match;
  });

  return result.replace(/\s+/g, " ").trim();
}

function cleanTrailingTokens(cleanName: string): string {
  const tokens = cleanName.split(/\s+/);

  while (tokens.length > 1) {
    const lastToken = tokens.at(-1);
    if (!lastToken) break;
    const last = lastToken.replace(/^-|-$/g, "");
    if (TAG_DISCARD_RE.test(last)) {
      tokens.pop();
    } else if (/^\d{4}$/.test(last)) {
      const year = parseInt(last, 10);
      if (year >= 1900 && year <= 2100) {
        tokens.pop();
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return tokens.join(" ").replace(/-$/, "").trim();
}

function extractTrailingGroup(
  cleanName: string,
  existing: string | null,
): { group: string | null; name: string } {
  if (existing) return { group: existing, name: cleanName };

  const sceneMatch = SCENE_GROUP_PAT.exec(cleanName);
  let potential: string | null = sceneMatch?.groups?.["group"] ?? null;

  if (!potential) {
    const tokens = cleanName.split(/\s+/);
    const last = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    if (last && /\.[a-z]{2,6}$/i.test(last)) {
      potential = last;
    }
  }

  if (!potential) return { group: null, name: cleanName };

  if (potential.includes("-")) {
    const parts = potential.split("-");
    const firstParts = parts.slice(0, -1).join("-");
    if (/^(?:x264|x265|h\.?264|h\.?265|hevc|10bit|12bit|aac|flac|mp3)$/i.test(firstParts)) {
      const lastPart = parts.at(-1);
      if (lastPart) {
        potential = lastPart;
      }
    }
  }

  if (TAG_DISCARD_RE.test(potential)) {
    return { group: null, name: cleanName };
  }

  return {
    group: potential,
    name: cleanName.slice(0, cleanName.lastIndexOf(potential)).trim().replace(/- $/, ""),
  };
}

export interface ExtractedData {
  tags: ParsedTags;
  cleanName: string;
}

export function extract(name: string): ExtractedData {
  let tags = extractTagsFromBrackets(name);
  tags = extractTagsFromTokens(name, tags);

  let cleanName = cleanMetaTokens(name);

  const groupResult = extractTrailingGroup(cleanName, tags.group);
  tags.group = groupResult.group;
  cleanName = groupResult.name;

  cleanName = cleanTrailingTokens(cleanName);

  return { tags, cleanName };
}
