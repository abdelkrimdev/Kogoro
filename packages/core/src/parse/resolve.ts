import type { ParsedResult, ParsedTags } from "./parser";

const YEAR_PAT = /\b(19\d{2}|20\d{2})\b/;

interface EpisodeInfo {
  season: number | null;
  episode: number | null;
  titleEnd: number;
}

const SEASON_ORDINAL_WORDS: Record<string, number> = {
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
};

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

function extractPrefixGroup(cleanName: string): { group: string | null; name: string } {
  const prefixMatch = cleanName.match(/^([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\s+-\s+/);
  if (prefixMatch?.[1]) {
    return {
      group: prefixMatch[1].trim(),
      name: cleanName.slice(prefixMatch[0].length).trim(),
    };
  }
  return { group: null, name: cleanName };
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

export function resolve(filename: string, cleanName: string, tags: ParsedTags): ParsedResult {
  if (!tags.group) {
    const prefix = extractPrefixGroup(cleanName);
    tags.group = prefix.group;
    cleanName = prefix.name;
  }

  const { season, episode, titleEnd: seasonTitleEnd } = extractSeasonEpisode(cleanName);
  const { episode: extraEpisode, titleEnd: epTitleEnd } = extractEpisode(cleanName);
  const finalEpisode = episode ?? extraEpisode;
  let cutAt = -1;
  if (seasonTitleEnd > 0) {
    cutAt = seasonTitleEnd;
  } else if (epTitleEnd > 0) {
    cutAt = epTitleEnd;
  }
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
