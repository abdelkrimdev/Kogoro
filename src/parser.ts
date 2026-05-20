export interface ParsedTags {
  group: string | null;
  resolution: string | null;
  source: string | null;
  codec: string | null;
  audio: string | null;
}

export interface ParsedResult {
  title: string | null;
  season: number | null;
  episode: number | null;
  tags: ParsedTags;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

// ---- Tag extraction helpers ----

const VIDEO_EXTS = /\.(mkv|mp4|avi|ogm|webm|flv|m4v)$/i;
const SCENE_GROUP_PAT = /(?<!\s)-(?<group>[a-zA-Z0-9_.-]+)$/;
const YEAR_PAT = /\b(19\d{2}|20\d{2})\b/;
const CRC_PAT = /[0-9A-Fa-f]{8}/;

/** Strip corrupted trailing extensions like `.mkv]` or `.mkv.mkv` */
function stripCorruptedExtensions(name: string): string {
  let current = name;
  while (true) {
    const trimmed = current.trim();
    if (trimmed.endsWith("]")) {
      const corrupt = /\.(mkv|mp4|avi|ogm|webm|flv|m4v)\]$/i.exec(trimmed);
      if (corrupt) {
        current = trimmed.slice(0, -1).trim();
        continue;
      }
    }
    if (VIDEO_EXTS.test(trimmed)) {
      current = stripExtension(trimmed);
      continue;
    }
    break;
  }
  return current;
}

/** Fix missing bracket and replace underscores */
function normalizeName(name: string): string {
  let result = name.trim();
  // e.g. "Mirai.ai] ..." -> "[Mirai.ai] ..."
  if (/^[^[\]]+\s*\]/.test(result) && !result.startsWith("[")) {
    result = `[${result}`;
  }
  return result.replace(/_/g, " ").trim();
}

/** Convert dots to spaces, preserving decimal dots and codec names */
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

// ---- Tag matching ----

/** Normalize token for tag matching */
function normalizeTag(token: string): string {
  return token.replace(/\./g, "").replace(/-/g, "").toLowerCase();
}

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
  "10bit",
  "8bit",
  "hi10",
  "hi10p",
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
  if (token === "x265" || token === "x264") return token;
  const normalized = normalizeTag(token);
  if (normalized === "10bit" || normalized === "8bit") return null;
  return CODEC_SET.has(normalized) ? normalized : null;
}

function parseAudio(token: string): string | null {
  if (/^DDP5\.1$/i.test(token)) return "ddp5.1";
  if (/^DD5\.1$/i.test(token)) return "dd5.1";
  if (/^DDP$/i.test(token)) return "ddp";
  const normalized = normalizeTag(token);
  return AUDIO_SET.has(normalized) ? normalized : null;
}

function parseSource(token: string): string | null {
  const normalized = normalizeTag(token);
  if (normalized === "bluray") return "bluray";
  if (normalized === "webdl") return "web-dl";
  return SOURCE_SET.has(normalized) ? normalized : null;
}

// ---- Extract tags from brackets and tokens ----

interface MutableTags {
  group: string | null;
  resolution: string | null;
  codec: string | null;
  source: string | null;
  audio: string | null;
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
  if (/^(1080p|720p|480p|x264|x265|hevc|aac|flac|bdrip|bluray|web-dl)$/.test(content)) return null;
  if (CRC_PAT.test(content) && content.length === 8) return null;
  return content;
}

function extractTagsFromBrackets(name: string): MutableTags {
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

function extractTagsFromTokens(name: string, existing: MutableTags): MutableTags {
  let { group, resolution, codec, source, audio } = existing;

  for (const raw of name.split(/[\s()[\]]+/)) {
    const token = raw.trim().replace(/^-|-$/g, "");
    if (!token) continue;

    const resMatch = /(\d+p)/i.exec(token);
    if (resMatch?.[1]) {
      resolution = resMatch[1].toLowerCase();
      continue;
    }

    const parsedRes = parseResolution(token);
    if (parsedRes) resolution = parsedRes;

    const codecRe =
      /\b(x265|x264|h\.?265|h\.?264|hevc|av1|vp9|avc|10bit|10-bit|8bit|hi10|hi10p)\b/gi;
    let m = codecRe.exec(token);
    while (m !== null) {
      if (m[1]) {
        const parsed = parseCodec(m[1]);
        if (parsed) {
          codec = parsed;
          break;
        }
      }
      m = codecRe.exec(token);
    }

    const sourceRe = /\b(bluray|bdrip|bd|web-dl|webrip|web|hdtv|dvd|dvdrip)\b/gi;
    let s = sourceRe.exec(token);
    while (s !== null) {
      if (s[1]) {
        const parsed = parseSource(s[1]);
        if (parsed) {
          source = parsed;
          break;
        }
      }
      s = sourceRe.exec(token);
    }

    const audioRe = /\b(aac|flac|mp3|opus|ac3|dts|ddp5\.1|dd5\.1|ddp)\b/gi;
    let a = audioRe.exec(token);
    while (a !== null) {
      if (a[1]) {
        const parsed = parseAudio(a[1]);
        if (parsed) {
          audio = parsed;
          break;
        }
      }
      a = audioRe.exec(token);
    }
  }

  return { group, resolution, codec, source, audio };
}

// ---- Name cleaning ----

/** Regex for known tag-like strings used in multiple places */
const TAG_DISCARD_RE =
  /^(1080p(?:mini)?|720p(?:mini)?|480p|2160p|576p|x264|x265|h\.?264|h\.?265|hevc|av1|vp9|avc|10bit|10-bit|8bit|hi10|hi10p|bluray|bdrip|bd|web-dl|webrip|web|hdtv|dvd|dvdrip|ld|aac|flac|mp3|opus|ac3|dts|ddp5\.1|dd5\.1|ddp|dd|v\d+|end|final|multi|weekly|dual|audio|nf|netflix|cr|crunchyroll|fun|funimation|amzn|amazon)$/i;
const DIMENSION_DISCARD_RE = /^\d+x\d+p?$/i;
const NUMBER_DISCARD_RE = /^\d+(?:\.\d+)?$/i;

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

// ---- Group extraction from end ----

function extractTrailingGroup(
  cleanName: string,
  existing: string | null,
): { group: string | null; name: string } {
  if (existing) return { group: existing, name: cleanName };

  const sceneMatch = SCENE_GROUP_PAT.exec(cleanName);
  // biome-ignore lint/complexity/useLiteralKeys: needed for index signature access
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

// ---- Episode extraction ----

function extractSeasonEpisode(cleanName: string): {
  season: number | null;
  episode: number | null;
} {
  const sMatch = /\bS(\d+)E(\d+)(?:v\d+)?\b/i.exec(cleanName);
  if (sMatch) {
    return { season: Number(sMatch[1]), episode: Number(sMatch[2]) };
  }
  return { season: null, episode: null };
}

function extractEpisode(cleanName: string): { episode: number | null; titleEnd: number } {
  const epDash = /\s+-\s+(\d+)(?:v\d+)?(?:\s+.+)?$/.exec(cleanName);
  if (epDash) {
    return { episode: Number(epDash[1]), titleEnd: cleanName.search(/\s+-\s+\d+/) };
  }
  const epEnd = /(?:\s+|-)(\d+)$/.exec(cleanName);
  if (epEnd) {
    const num = Number(epEnd[1]);
    if (num < 1900 || num > 2100) {
      return { episode: num, titleEnd: cleanName.search(/(?:\s+|-)\d+$/) };
    }
  }
  return { episode: null, titleEnd: -1 };
}

// ---- Main pipeline ----

function shouldReturnEmpty(
  filename: string,
  {
    season,
    episode,
    group,
  }: { season: number | null; episode: number | null; group: string | null },
  tags: MutableTags,
): boolean {
  const hasSpaces = filename.includes(" ") || filename.includes("_");
  const hasTags =
    tags.resolution !== null || tags.codec !== null || tags.source !== null || tags.audio !== null;
  return (
    !hasSpaces &&
    season === null &&
    episode === null &&
    group === null &&
    !hasTags &&
    !YEAR_PAT.test(filename)
  );
}

function parseWithPipeline(filename: string): ParsedResult {
  let name = stripExtension(filename);

  name = stripCorruptedExtensions(name);
  name = normalizeName(name);
  name = normalizeDots(name);

  let tags = extractTagsFromBrackets(name);
  tags = extractTagsFromTokens(name, tags);

  let cleanName = cleanMetaTokens(name);

  const groupResult = extractTrailingGroup(cleanName, tags.group);
  tags.group = groupResult.group;
  cleanName = groupResult.name;

  if (!tags.group) {
    const prefixMatch = cleanName.match(/^([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\s+-\s+/);
    if (prefixMatch?.[1]) {
      tags.group = prefixMatch[1].trim();
      cleanName = cleanName.slice(prefixMatch[0].length).trim();
    }
  }

  cleanName = cleanTrailingTokens(cleanName);

  const { season, episode } = extractSeasonEpisode(cleanName);
  const { episode: extraEpisode, titleEnd } = extractEpisode(cleanName);
  const finalEpisode = episode ?? extraEpisode;
  let title = cleanName;
  if (titleEnd > 0) {
    title = cleanName.slice(0, titleEnd).trim().replace(/-$/, "").trim();
  } else if (season !== null) {
    const idx = cleanName.search(/\bS\d+E\d+(?:v\d+)?\b/i);
    if (idx > 0) {
      title = cleanName.slice(0, idx).trim().replace(/-$/, "").trim();
    }
  }

  if (shouldReturnEmpty(filename, { season, episode: finalEpisode, group: tags.group }, tags)) {
    return createEmptyResult();
  }

  return {
    title: title || null,
    season,
    episode: finalEpisode,
    tags: {
      group: tags.group || null,
      resolution: tags.resolution || null,
      source: tags.source || null,
      codec: tags.codec || null,
      audio: tags.audio || null,
    },
  };
}

export function parse(filename: string): ParsedResult {
  return parseWithPipeline(filename);
}

export function createEmptyResult(): ParsedResult {
  return {
    title: null,
    season: null,
    episode: null,
    tags: {
      group: null,
      resolution: null,
      source: null,
      codec: null,
      audio: null,
    },
  };
}
