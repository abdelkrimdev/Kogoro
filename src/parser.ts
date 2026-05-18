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

const defaultPatterns: RegExp[] = [
  /^\[(?<group>[^\]]+)\]\s*(?<title>.+?)\s*-\s*(?<episode>\d+)\s*(?:\((?<resolution>[^)]*?)\))?\s*(?:\[(?<codec>[^\]]+)\])?$/,
  /^(?<title>.+?)\s*-\s*S(?<season>\d+)E(?<episode>\d+)$/,
  /^(?<title>.+?)\s*-\s*(?<episode>\d+)(?:\s*\[[^\]]+\])?$/,
  /^\[(?<group>[^\]]+)\]\s*(?<title>.+)$/,
];

function tryPatterns(name: string, patterns?: RegExp[]): ParsedResult | null {
  const activePatterns = patterns ?? defaultPatterns;
  for (const pattern of activePatterns) {
    const match = name.match(pattern);
    if (!match?.groups) {
      continue;
    }

    const { title, episode, season, group, resolution, codec } = match.groups;
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) {
      continue;
    }

    const episodeNum = episode ? Number(episode) : null;
    if (episodeNum !== null && (Number.isNaN(episodeNum) || episodeNum < 0)) {
      continue;
    }

    const seasonNum = season ? Number(season) : null;
    if (seasonNum !== null && (Number.isNaN(seasonNum) || seasonNum < 0)) {
      continue;
    }

    return {
      title: trimmedTitle,
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

function createEmptyResult(): ParsedResult {
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

export function parse(filename: string, options?: ParserOptions): ParsedResult {
  const name = stripExtension(filename);
  return tryPatterns(name, options?.patterns) ?? createEmptyResult();
}
