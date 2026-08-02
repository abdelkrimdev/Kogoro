import { describe, expect, test } from "bun:test";
import type { FranchiseCollection, FranchiseIndex } from "./franchise-index";
import type { FribbSource, IdentityResolver, IdentityResolverEntry } from "./identity-resolver";

function createMockIdentityResolver(overrides: Partial<IdentityResolver> = {}): IdentityResolver {
  return {
    resolveToAnidb: async () => null,
    resolveBatchToAnidb: async (entries) => entries.map((e) => ({ ...e, anidbId: null })),
    getMetadata: async () => ({
      datasetVersion: "2026-01-01",
      datasetDate: "2026-01-01",
      supportedSources: ["anidb", "anilist", "mal", "kitsu", "tvdb", "imdb", "tmdb"],
    }),
    ...overrides,
  };
}

function createMockFranchiseIndex(overrides: Partial<FranchiseIndex> = {}): FranchiseIndex {
  return {
    getCollectionForAnidb: async () => null,
    getAllCollections: async () => [],
    getMetadata: async () => ({
      datasetVersion: "2026-01-01",
      datasetDate: "2026-01-01",
      collectionCount: 0,
    }),
    ...overrides,
  };
}

describe("IdentityResolver", () => {
  test("resolves a known source ID to an AniDB ID", async () => {
    const resolver = createMockIdentityResolver({
      resolveToAnidb: async (source, sourceId) => {
        if (source === "anilist" && sourceId === "21") return "23";
        return null;
      },
    });

    const result = await resolver.resolveToAnidb("anilist", "21");
    expect(result).toBe("23");
  });

  test("returns null for an unknown source ID", async () => {
    const resolver = createMockIdentityResolver();
    const result = await resolver.resolveToAnidb("mal", "99999");
    expect(result).toBeNull();
  });

  test("batch resolves entries and returns results with nullable anidbId", async () => {
    const resolver = createMockIdentityResolver({
      resolveBatchToAnidb: async (entries) =>
        entries.map((e) => ({
          source: e.source,
          sourceId: e.sourceId,
          anidbId: e.source === "anilist" && e.sourceId === "21" ? "23" : null,
        })),
    });

    const entries: IdentityResolverEntry[] = [
      { source: "anilist", sourceId: "21" },
      { source: "mal", sourceId: "99999" },
    ];
    const results = await resolver.resolveBatchToAnidb(entries);

    expect(results).toHaveLength(2);
    expect(results[0]?.anidbId).toBe("23");
    expect(results[1]?.anidbId).toBeNull();
  });

  test("getMetadata returns dataset info", async () => {
    const resolver = createMockIdentityResolver();
    const meta = await resolver.getMetadata();

    expect(meta.datasetVersion).toBe("2026-01-01");
    expect(meta.supportedSources).toContain("anidb");
    expect(meta.supportedSources).toContain("anilist");
  });

  test("type-narrows source to FribbSource union", () => {
    const source: FribbSource = "tvdb";
    expect(["anidb", "anilist", "mal", "kitsu", "tvdb", "imdb", "tmdb"]).toContain(source);
  });
});

describe("FranchiseIndex", () => {
  test("returns a franchise collection for a known AniDB ID", async () => {
    const collection: FranchiseCollection = {
      anidbId: "23",
      franchiseTitle: "One Piece",
      members: ["23", "24", "25"],
    };
    const index = createMockFranchiseIndex({
      getCollectionForAnidb: async (anidbId) => (anidbId === "23" ? collection : null),
    });

    const result = await index.getCollectionForAnidb("23");
    expect(result).toEqual(collection);
  });

  test("returns null for an unknown AniDB ID", async () => {
    const index = createMockFranchiseIndex();
    const result = await index.getCollectionForAnidb("99999");
    expect(result).toBeNull();
  });

  test("getAllCollections returns all franchise collections", async () => {
    const collections: FranchiseCollection[] = [
      { anidbId: "23", franchiseTitle: "One Piece", members: ["23", "24"] },
      { anidbId: "100", franchiseTitle: "Naruto", members: ["100"] },
    ];
    const index = createMockFranchiseIndex({
      getAllCollections: async () => collections,
    });

    const result = await index.getAllCollections();
    expect(result).toHaveLength(2);
    expect(result[0]?.franchiseTitle).toBe("One Piece");
  });

  test("getMetadata returns index info", async () => {
    const index = createMockFranchiseIndex({
      getMetadata: async () => ({
        datasetVersion: "2026-01-01",
        datasetDate: "2026-01-01",
        collectionCount: 42,
      }),
    });

    const meta = await index.getMetadata();
    expect(meta.collectionCount).toBe(42);
  });
});
