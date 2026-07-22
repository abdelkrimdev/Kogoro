import { describe, expect, mock, test } from "bun:test";
import { createMockEnrichmentProvider } from "../fixtures";
import { AnimeAggregate } from "./anime-aggregate";
import { BackgroundRetryService } from "./background-retry";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

function createTestAggregate(resolvedAnilistId: string | null = null) {
  const { db, sqlite } = createLibraryDb();
  const repo = new LibraryRepository(db);
  const aggregate = new AnimeAggregate({
    library: repo,
    replayUnpushedEvents: () => {},
    computeAndPersistLibraryState: () => {},
    enrichmentProviderFactory: async () =>
      createMockEnrichmentProvider({
        searchByTitle: resolvedAnilistId
          ? async (title) => ({
              anilistId: resolvedAnilistId,
              title,
              format: "TV",
              episodes: 12,
            })
          : async () => null,
      }),
  });
  return { repo, aggregate, sqlite };
}

describe("BackgroundRetryService", () => {
  test("does not run when isActive returns true", async () => {
    const { aggregate, sqlite } = createTestAggregate("al-123");
    try {
      const onResolved = mock(() => {});
      const service = new BackgroundRetryService({
        animeAggregate: aggregate,
        isActive: () => true,
        onResolved,
      });

      const result = await service.runNow();

      expect(result).toBeNull();
      expect(onResolved).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
    }
  });

  test("runs retry when isActive returns false", async () => {
    const { repo, aggregate, sqlite } = createTestAggregate("al-resolved");
    try {
      repo.upsertAnime({ title: "Pending Anime", episodeCount: 12 });

      const onResolved = mock(() => {});
      const service = new BackgroundRetryService({
        animeAggregate: aggregate,
        isActive: () => false,
        onResolved,
      });

      const result = await service.runNow();

      expect(result).not.toBeNull();
      expect(result?.resolved).toHaveLength(1);
      expect(onResolved).toHaveBeenCalledWith([{ id: expect.any(Number) }]);
    } finally {
      sqlite.close();
    }
  });

  test("skips retry when already running", async () => {
    const { aggregate, sqlite } = createTestAggregate("al-123");
    try {
      const service = new BackgroundRetryService({
        animeAggregate: aggregate,
        isActive: () => false,
      });

      const [result1, result2] = await Promise.all([service.runNow(), service.runNow()]);

      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("calls onError when retry throws", async () => {
    const { db, sqlite } = createLibraryDb();
    const repo = new LibraryRepository(db);
    const aggregate = new AnimeAggregate({
      library: repo,
      replayUnpushedEvents: () => {},
      computeAndPersistLibraryState: () => {},
      enrichmentProviderFactory: async () => {
        throw new Error("Enrichment failed");
      },
    });

    try {
      const onError = mock(() => {});
      const service = new BackgroundRetryService({
        animeAggregate: aggregate,
        isActive: () => false,
        onError,
      });

      const result = await service.runNow();

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    } finally {
      sqlite.close();
    }
  });

  test("start and stop manage interval", async () => {
    const { aggregate, sqlite } = createTestAggregate("al-123");
    try {
      const service = new BackgroundRetryService({
        animeAggregate: aggregate,
        isActive: () => false,
        intervalMs: 100,
      });

      service.start();
      service.stop();
    } finally {
      sqlite.close();
    }
  });
});
