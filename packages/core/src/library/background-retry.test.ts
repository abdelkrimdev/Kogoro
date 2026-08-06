import { describe, expect, mock, test } from "bun:test";
import { createMockIdentityResolver } from "../fixtures";
import { AnimeAggregate } from "./anime-aggregate";
import { BackgroundRetryService } from "./background-retry";
import { createLibraryRepos } from "./schema";
import { createLibraryDb } from "./test-utils";

function createTestAggregate() {
  const { db, sqlite } = createLibraryDb();
  const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
  const aggregate = new AnimeAggregate({
    anime: animeRepo,
    episodes: episodeRepo,
    groups: groupRepo,
    replayUnpushedEvents: () => {},
    identityResolver: createMockIdentityResolver(),
    resolveTitleToAnidb: async () => null,
  });
  return { animeRepo, aggregate, sqlite };
}

describe("BackgroundRetryService", () => {
  test("does not run when isActive returns true", async () => {
    const { aggregate, sqlite } = createTestAggregate();
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
    const { animeRepo, aggregate, sqlite } = createTestAggregate();
    try {
      animeRepo.upsertAnime({ title: "Pending Anime" });

      const onResolved = mock(() => {});
      const service = new BackgroundRetryService({
        animeAggregate: aggregate,
        isActive: () => false,
        onResolved,
      });

      const result = await service.runNow();

      expect(result).not.toBeNull();
      expect(result?.resolved).toHaveLength(0);
      expect(result?.stillPending).toHaveLength(1);
      expect(onResolved).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
    }
  });

  test("skips retry when already running", async () => {
    const { aggregate, sqlite } = createTestAggregate();
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

  test("start and stop manage interval", async () => {
    const { aggregate, sqlite } = createTestAggregate();
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
