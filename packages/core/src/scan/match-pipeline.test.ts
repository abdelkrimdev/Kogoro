import { describe, expect, test } from "bun:test";
import { makeCachedMatch, makeMatchResult, makeNoMatchResult, makeParsedResult } from "../fixtures";
import type { MatcherLike, MatchResult } from "../match/matcher";
import type { ManualResolution, MatchInput } from "./match-pipeline";
import {
  applyEntryTypeOverride,
  checkCached,
  checkOverride,
  filterViableMatches,
  getDirectoryTitle,
  MatchPipeline,
  parseFilePath,
  resolveManual,
  resolveMatches,
} from "./match-pipeline";

function makeInput(overrides?: Partial<MatchInput>): MatchInput {
  return {
    parsed: makeParsedResult("My Anime", 1, 1),
    override: null,
    cachedMatch: null,
    sourceDb: "tvdb",
    ...overrides,
  };
}

function createMockMatcher(results?: MatchResult[]): MatcherLike {
  const defaultResults = results ?? [makeMatchResult()];
  return {
    async match() {
      return defaultResults;
    },
    async matchBatch(parsedList) {
      return parsedList.map((_, i) => {
        const r = defaultResults[i % defaultResults.length];
        if (!r) return makeMatchResult();
        return r;
      });
    },
  };
}

function createAmbiguousMatcher(): MatcherLike {
  return {
    async match(parsed) {
      return [
        {
          anime: { id: "1", titleEn: parsed.title ?? "", entryType: "tv" as const },
          episode: {
            id: "101",
            animeId: "1",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv" as const,
          },
          score: 1,
        },
        {
          anime: {
            id: "2",
            titleEn: `${parsed.title ?? ""} Special`,
            entryType: "special" as const,
          },
          episode: {
            id: "201",
            animeId: "2",
            season: 1,
            episode: 1,
            titleEn: "Special",
            entryType: "special" as const,
          },
          score: 0.85,
        },
      ];
    },
    async matchBatch(parsedList) {
      const results: MatchResult[] = [];
      for (const p of parsedList) {
        const matches = await this.match(p);
        results.push(
          matches[0] ?? {
            anime: { id: "", titleEn: "", entryType: "tv" },
            score: 0,
            failureReason: "No match",
          },
        );
      }
      return results;
    },
  };
}

describe("parseFilePath", () => {
  test("parses anime title from filename", () => {
    const result = parseFilePath("[Group] My Anime - 01.mkv");
    expect(result.title).toBe("My Anime");
    expect(result.episode).toBe(1);
  });

  test("falls back to parent directory name when title is not parsed", () => {
    const result = parseFilePath("/anime/Summertime Render/[Group].mkv");
    expect(result.title).toBe("Summertime Render");
  });

  test("falls back to grandparent directory under category folder", () => {
    const result = parseFilePath("/anime/Jujutsu Kaisen/TV/[Group].mkv");
    expect(result.title).toBe("Jujutsu Kaisen");
  });

  test("does not override already-parsed title", () => {
    const result = parseFilePath("/anime/Wrong Name/[SubsPlease] Correct Name - 01.mkv");
    expect(result.title).toBe("Correct Name");
  });
});

describe("getDirectoryTitle", () => {
  test("returns parent directory name", () => {
    expect(getDirectoryTitle("/anime/Oshi no Ko/file.mkv")).toBe("Oshi no Ko");
  });

  test("derives from grandparent when nested under category folder", () => {
    expect(getDirectoryTitle("/anime/Oshi no Ko/TV/file.mkv")).toBe("Oshi no Ko");
  });

  test("returns null for root-level files", () => {
    expect(getDirectoryTitle("/file.mkv")).toBeNull();
    expect(getDirectoryTitle("file.mkv")).toBeNull();
  });

  test("returns grandparent when parent is organized dir", () => {
    expect(getDirectoryTitle("/anime/TV/file.mkv")).toBe("anime");
  });

  test("returns null for hash-suffixed directory names", () => {
    expect(getDirectoryTitle("/downloads/subsplease-abc123def456/file.mkv")).toBeNull();
  });
});

describe("checkCached", () => {
  test("returns null when no cached match", () => {
    const input = makeInput();
    expect(checkCached(input)).toBeNull();
  });

  test("returns cached decision with match from cache", () => {
    const cachedMatch = makeCachedMatch({ animeId: "tvdb-42" });
    const input = makeInput({ cachedMatch });
    const decision = checkCached(input);

    expect(decision).not.toBeNull();
    expect(decision?.type).toBe("cached");
    if (decision?.type === "cached") {
      expect(decision.match.anime.id).toBe("tvdb-42");
    }
  });
});

describe("checkOverride", () => {
  test("returns null when no override", () => {
    const input = makeInput();
    expect(checkOverride(input)).toBeNull();
  });

  test("returns null when override has no animeId", () => {
    const input = makeInput({ override: { entryType: "special" } });
    expect(checkOverride(input)).toBeNull();
  });

  test("returns override decision with animeId", () => {
    const input = makeInput({
      override: { animeId: "tvdb-99", episodeId: "ep-5", entryType: "special" },
    });
    const decision = checkOverride(input);

    expect(decision).not.toBeNull();
    expect(decision?.type).toBe("override");
    if (decision?.type === "override") {
      expect(decision.match.anime.id).toBe("tvdb-99");
      expect(decision.match.anime.entryType).toBe("special");
    }
  });
});

describe("applyEntryTypeOverride", () => {
  test("does nothing when entryType is undefined", () => {
    const matches = [makeMatchResult()];
    applyEntryTypeOverride(matches);
    expect(matches[0]?.anime.entryType).toBe("tv");
  });

  test("overrides entryType on all matches and episodes", () => {
    const matches = [makeMatchResult()];
    applyEntryTypeOverride(matches, "special");

    expect(matches[0]?.anime.entryType).toBe("special");
    expect(matches[0]?.episode?.entryType).toBe("special");
  });

  test("handles matches without episodes", () => {
    const matches = [makeMatchResult({ episode: undefined })];
    applyEntryTypeOverride(matches, "movie");

    expect(matches[0]?.anime.entryType).toBe("movie");
    expect(matches[0]?.episode).toBeUndefined();
  });
});

describe("filterViableMatches", () => {
  test("filters out failure matches", () => {
    const matches = [
      makeMatchResult(),
      makeNoMatchResult("error"),
      makeMatchResult({ anime: { id: "2", titleEn: "Other", entryType: "tv" } }),
    ];
    const viable = filterViableMatches(matches, true);
    expect(viable).toHaveLength(2);
  });

  test("filters out matches without episodes when hasEpisode is true", () => {
    const matches = [makeMatchResult(), makeMatchResult({ episode: undefined })];
    const viable = filterViableMatches(matches, true);
    expect(viable).toHaveLength(1);
  });

  test("keeps matches without episodes when hasEpisode is false", () => {
    const matches = [makeMatchResult(), makeMatchResult({ episode: undefined })];
    const viable = filterViableMatches(matches, false);
    expect(viable).toHaveLength(2);
  });
});

describe("resolveMatches", () => {
  test("returns failed for empty matches", () => {
    const decision = resolveMatches([]);
    expect(decision.type).toBe("failed");
    if (decision.type === "failed") {
      expect(decision.failureReason).toBe("No matching episode found");
    }
  });

  test("returns match when single clear winner", () => {
    const matches = [makeMatchResult()];
    const decision = resolveMatches(matches);
    expect(decision.type).toBe("match");
    if (decision.type === "match") {
      expect(decision.match.anime.id).toBe("1");
    }
  });

  test("returns ambiguous when multiple anime with similar scores", () => {
    const matches = [
      makeMatchResult({ score: 1 }),
      makeMatchResult({
        anime: { id: "2", titleEn: "Other", entryType: "tv" },
        score: 0.9,
      }),
    ];
    const decision = resolveMatches(matches);
    expect(decision.type).toBe("ambiguous");
  });

  test("returns match when clear score margin between top two", () => {
    const matches = [
      makeMatchResult({ score: 1 }),
      makeMatchResult({
        anime: { id: "2", titleEn: "Other", entryType: "tv" },
        score: 0.5,
      }),
    ];
    const decision = resolveMatches(matches);
    expect(decision.type).toBe("match");
  });
});

describe("resolveManual", () => {
  test("creates match result from manual resolution", () => {
    const resolution: ManualResolution = {
      animeId: "99",
      episode: 5,
      entryType: "special",
    };
    const match = resolveManual(resolution);

    expect(match.anime.id).toBe("99");
    expect(match.anime.entryType).toBe("special");
    expect(match.episode?.episode).toBe(5);
    expect(match.episode?.entryType).toBe("special");
  });
});

describe("MatchPipeline", () => {
  test("returns cached decision when cached match exists", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const cachedMatch = makeCachedMatch({ animeId: "cached-1" });

    const decision = await pipeline.decide(makeInput({ cachedMatch }));

    expect(decision.type).toBe("cached");
    if (decision.type === "cached") {
      expect(decision.match.anime.id).toBe("cached-1");
    }
  });

  test("returns override decision when override with animeId exists", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const decision = await pipeline.decide(makeInput({ override: { animeId: "override-1" } }));

    expect(decision.type).toBe("override");
    if (decision.type === "override") {
      expect(decision.match.anime.id).toBe("override-1");
    }
  });

  test("matches against database when no cache or override", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const decision = await pipeline.decide(makeInput());

    expect(decision.type).toBe("match");
    if (decision.type === "match") {
      expect(decision.match.anime.titleEn).toBe("Jujutsu Kaisen");
    }
  });

  test("applies entryType override to match results", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const decision = await pipeline.decide(makeInput({ override: { entryType: "special" } }));

    expect(decision.type).toBe("match");
    if (decision.type === "match") {
      expect(decision.match.anime.entryType).toBe("special");
      expect(decision.match.episode?.entryType).toBe("special");
    }
  });

  test("returns failed when no title parsed and no matches", async () => {
    const pipeline = new MatchPipeline(createMockMatcher([makeNoMatchResult("No title parsed")]));
    const decision = await pipeline.decide(makeInput({ parsed: makeParsedResult(null) }));

    expect(decision.type).toBe("failed");
  });

  test("returns failed when matcher returns failure", async () => {
    const pipeline = new MatchPipeline(createMockMatcher([makeNoMatchResult("No anime found")]));
    const decision = await pipeline.decide(makeInput());

    expect(decision.type).toBe("failed");
    if (decision.type === "failed") {
      expect(decision.failureReason).toBe("No anime found");
    }
  });

  test("returns ambiguous when multiple candidates with close scores", async () => {
    const pipeline = new MatchPipeline(createAmbiguousMatcher());
    const decision = await pipeline.decide(makeInput());

    expect(decision.type).toBe("ambiguous");
  });

  test("decide with precomputed match uses provided match instead of calling matcher", async () => {
    let matchCalled = false;
    const matcher: MatcherLike = {
      async match() {
        matchCalled = true;
        return [makeMatchResult()];
      },
      async matchBatch() {
        matchCalled = true;
        return [makeMatchResult()];
      },
    };
    const pipeline = new MatchPipeline(matcher);
    const precomputed = makeMatchResult();

    const decision = await pipeline.decide(makeInput(), precomputed);

    expect(matchCalled).toBe(false);
    expect(decision.type).toBe("match");
  });

  test("decide with null precomputed falls back to matcher", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const decision = await pipeline.decide(makeInput(), null);

    expect(decision.type).toBe("match");
  });

  test("prioritizes cache over override", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const cachedMatch = makeCachedMatch({ animeId: "cached-1" });

    const decision = await pipeline.decide(
      makeInput({
        cachedMatch,
        override: { animeId: "override-1" },
      }),
    );

    expect(decision.type).toBe("cached");
  });

  test("prioritizes override over database match", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());

    const decision = await pipeline.decide(makeInput({ override: { animeId: "override-1" } }));

    expect(decision.type).toBe("override");
  });

  test("caches match from decide with precomputed in batch flow", async () => {
    const pipeline = new MatchPipeline(createMockMatcher());
    const cachedMatch = makeCachedMatch();

    const decision = await pipeline.decide(makeInput({ cachedMatch }), null);

    expect(decision.type).toBe("cached");
  });
});
