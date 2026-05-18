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

export interface ParserOptions {
  patterns?: RegExp[];
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

const DEFAULT_PATTERNS: RegExp[] = [
  /^\[(?<group>[^\]]+)\]\s*(?<title>.+?)\s*-\s*(?<episode>\d+)\s*(?:\((?<resolution>[^)]*?)\))?\s*(?:\[(?<codec>[^\]]+)\])?$/,
  /^(?<title>.+?)\s*-\s*S(?<season>\d+)E(?<episode>\d+)$/,
  /^(?<title>.+?)\s*-\s*(?<episode>\d+)\s*(?:\[(?<tag>[^\]]+)\])?$/,
  /^\[(?<group>[^\]]+)\]\s*(?<title>.+)$/,
];

function matchPattern(name: string, patterns?: RegExp[]): Partial<ParsedResult> | null {
  const activePatterns = patterns ?? DEFAULT_PATTERNS;
  for (const pattern of activePatterns) {
    const match = name.match(pattern);
    if (!match?.groups) continue;
    const { title, episode, season, group, resolution, codec } = match.groups;

    if (!title?.trim()) continue;

    const episodeNum = episode ? Number(episode) : null;
    if (episodeNum !== null && (Number.isNaN(episodeNum) || episodeNum < 0)) continue;

    const seasonNum = season ? Number(season) : null;
    if (seasonNum !== null && (Number.isNaN(seasonNum) || seasonNum < 0)) continue;

    return {
      title: title.trim(),
      season: seasonNum,
      episode: episodeNum,
      tags: {
        group: group?.trim() ?? null,
        resolution: resolution?.trim() ?? null,
        source: null,
        codec: codec?.trim() ?? null,
        audio: null,
      },
    };
  }

  return null;
}

export function parse(filename: string, options?: ParserOptions): ParsedResult {
  const name = stripExtension(filename);
  const result = matchPattern(name, options?.patterns);

  if (!result) {
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

  return {
    title: result.title ?? null,
    season: result.season ?? null,
    episode: result.episode ?? null,
    tags: {
      group: result.tags?.group ?? null,
      resolution: result.tags?.resolution ?? null,
      source: result.tags?.source ?? null,
      codec: result.tags?.codec ?? null,
      audio: result.tags?.audio ?? null,
    },
  };
}
