export interface ParsedTags {
  group: string | null;
  resolution: string | null;
  source: string | null;
  codec: string | null;
  audio: string | null;
}

import { SCHEMA_DEFAULTS } from "../config/schema";

export interface ParsedResult {
  title: string | null;
  season: number | null;
  episode: number | null;
  tags: ParsedTags;
}

interface EpisodeInfo {
  season: number | null;
  episode: number | null;
  titleEnd: number;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

const SCENE_GROUP_PAT = /(?<!\s)-(?<group>[a-zA-Z0-9_.-]+)$/;
const YEAR_PAT = /\b(19\d{2}|20\d{2})\b/;
const CRC_PAT = /[0-9A-Fa-f]{8}/;

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

const TAG_DISCARD_RE =
  /^(1080p(?:mini)?|720p(?:mini)?|480p|2160p|576p|x264|x265|h\.?264|h\.?265|hevc|av1|vp9|avc|divx|xvid|10bit|10-bit|8bit|hi10|hi10p|bluray|bdrip|bd|web-dl|webrip|web|hdtv|dvd|dvdrip|ld|aac|flac|mp3|opus|ac3|dts|ddp5\.1|dd5\.1|ddp51|dd51|ddp|dd|v\d+|end|final|multi|weekly|dual|audio|nf|netflix|cr|crunchyroll|fun|funimation|amzn|amazon)$/i;
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

function extractSeasonEpisode(cleanName: string): EpisodeInfo {
  const sMatch = /\bS(\d+)E(\d+)(?:v\d+)?\b/i.exec(cleanName);
  if (sMatch) {
    return { season: Number(sMatch[1]), episode: Number(sMatch[2]), titleEnd: sMatch.index };
  }
  const sDashMatch = /\bS(\d+)\s+-\s+(\d+)(?:v\d+)?\b/i.exec(cleanName);
  if (sDashMatch) {
    return {
      season: Number(sDashMatch[1]),
      episode: Number(sDashMatch[2]),
      titleEnd: sDashMatch.index,
    };
  }
  const xMatch = /\b(\d+)x(\d+)(?:v\d+)?\b/i.exec(cleanName);
  if (xMatch) {
    return {
      season: Number(xMatch[1]),
      episode: Number(xMatch[2]),
      titleEnd: xMatch.index,
    };
  }
  return { season: null, episode: null, titleEnd: -1 };
}

function extractEpisode(cleanName: string): EpisodeInfo {
  const epDash = /\s+-\s*(\d+)(?:v\d+)?(?:\s+.+)?$/.exec(cleanName);
  if (epDash) {
    return {
      season: null,
      episode: Number(epDash[1]),
      titleEnd: cleanName.search(/\s+-\s*\d+/),
    };
  }
  const epEnd = /(?:\s+|-)(\d+)(?:v\d+)?$/.exec(cleanName);
  if (epEnd) {
    const num = Number(epEnd[1]);
    if (num < 1900 || num > 2100) {
      return {
        season: null,
        episode: num,
        titleEnd: cleanName.search(/(?:\s+|-)\d+(?:v\d+)?$/),
      };
    }
  }
  return { season: null, episode: null, titleEnd: -1 };
}

const SEASON_ORDINAL_WORDS: Record<string, number> = {
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
};

function extractSeasonFromTitle(title: string): {
  title: string;
  season: number | null;
} {
  const ordinalMatch = title.match(/\b(\d+)(?:st|nd|rd|th)\s+Season\b/i);
  if (ordinalMatch?.[1]) {
    const season = Number.parseInt(ordinalMatch[1], 10);
    const cleaned = title.replace(/\s*\d+(?:st|nd|rd|th)\s+Season\b/i, "").trim();
    return { title: cleaned, season };
  }

  const seasonNumMatch = title.match(/\bSeason\s+(\d+)\b/i);
  if (seasonNumMatch?.[1]) {
    const season = Number.parseInt(seasonNumMatch[1], 10);
    const cleaned = title.replace(/\s*Season\s+\d+\b/i, "").trim();
    return { title: cleaned, season };
  }

  const wordMatch = title.match(/\b(Second|Third|Fourth|Fifth)\s+Season\b/i);
  if (wordMatch?.[1]) {
    const key = wordMatch[1].toLowerCase();
    const season = SEASON_ORDINAL_WORDS[key] ?? null;
    const cleaned = title.replace(/\s*(?:Second|Third|Fourth|Fifth)\s+Season\b/i, "").trim();
    return { title: cleaned, season };
  }

  return { title, season: null };
}

function shouldReturnEmpty(
  filename: string,
  {
    season,
    episode,
    group,
  }: { season: number | null; episode: number | null; group: string | null },
  tags: ParsedTags,
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

export function parse(filename: string, extensions?: readonly string[]): ParsedResult {
  const exts = extensions ?? SCHEMA_DEFAULTS["media-extensions"];
  let name = stripExtension(filename);

  name = stripCorruptedExtensions(name, exts);
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

  const { season, episode, titleEnd: seasonTitleEnd } = extractSeasonEpisode(cleanName);
  const { episode: extraEpisode, titleEnd: epTitleEnd } = extractEpisode(cleanName);
  const finalEpisode = episode ?? extraEpisode;
  const cutAt = seasonTitleEnd > 0 ? seasonTitleEnd : epTitleEnd > 0 ? epTitleEnd : -1;
  const rawTitle =
    cutAt > 0 ? cleanName.slice(0, cutAt).trim().replace(/-$/, "").trim() : cleanName;

  const { title: cleanedTitle, season: qualifierSeason } = extractSeasonFromTitle(rawTitle);
  const finalSeason = season ?? qualifierSeason;

  if (
    shouldReturnEmpty(
      filename,
      { season: finalSeason, episode: finalEpisode, group: tags.group },
      tags,
    )
  ) {
    return createEmptyResult();
  }

  return {
    title: cleanedTitle || null,
    season: finalSeason,
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
