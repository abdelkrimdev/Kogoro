import { describe, expect, test } from "bun:test";
import { createMockFranchiseIndex, createMockIdentityResolver } from "../fixtures";
import type { FranchiseCollection } from "./franchise-index";
import type { FribbSource, IdentityResolverEntry } from "./identity-resolver";

describe("IdentityResolver", () => {
  test("resolves a known source ID to an AniDB ID", async () => {
    const resolver = createMockIdentityResolver(new Map([["21", "23"]]));

    const result = await resolver.resolveToAnidb("anilist", "21");
    expect(result).toBe("23");
  });

  test("returns null for an unknown source ID", async () => {
    const resolver = createMockIdentityResolver();
    const result = await resolver.resolveToAnidb("mal", "99999");
    expect(result).toBeNull();
  });

  test("batch resolves entries and returns results with nullable anidbId", async () => {
    const resolver = createMockIdentityResolver(new Map([["21", "23"]]));

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

    expect(meta.datasetVersion).toBe("mock");
    expect(meta.supportedSources).toEqual([]);
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
    const index = createMockFranchiseIndex([collection]);

    const result = await index.getCollectionForAnidb("23");
    expect(result).toEqual(collection);
  });

  test("returns null for an unknown AniDB ID", async () => {
    const index = createMockFranchiseIndex([]);
    const result = await index.getCollectionForAnidb("99999");
    expect(result).toBeNull();
  });

  test("getAllCollections returns all franchise collections", async () => {
    const collections: FranchiseCollection[] = [
      { anidbId: "23", franchiseTitle: "One Piece", members: ["23", "24"] },
      { anidbId: "100", franchiseTitle: "Naruto", members: ["100"] },
    ];
    const index = createMockFranchiseIndex(collections);

    const result = await index.getAllCollections();
    expect(result).toHaveLength(2);
    expect(result[0]?.franchiseTitle).toBe("One Piece");
  });

  test("getMetadata returns index info", async () => {
    const collections: FranchiseCollection[] = [
      { anidbId: "23", franchiseTitle: "One Piece", members: ["23", "24"] },
    ];
    const index = createMockFranchiseIndex(collections);

    const meta = await index.getMetadata();
    expect(meta.collectionCount).toBe(1);
  });
});
