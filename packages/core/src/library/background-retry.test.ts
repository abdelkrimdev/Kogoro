import { describe, expect, mock, test } from "bun:test";
import { createMockIdentityResolver } from "../fixtures";
import { AnimeImporter } from "./anime-importer";
import { BackgroundRetryService } from "./background-retry";
import { createLibraryRepos } from "./schema";
import { createLibraryDb } from "./test-utils";

function createTestImporter() {
  const { db, sqlite } = createLibraryDb();
  const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
  const importer = new AnimeImporter({
    anime: animeRepo,
    episodes: episodeRepo,
    groups: groupRepo,
    identityResolver: createMockIdentityResolver(),
    resolveTitleToAnidb: async () => null,
    resolveAndMerge: async () => ({ animeIds: [] }),
  });
  return { animeRepo, importer, sqlite };
}

describe("BackgroundRetryService", () => {
  test("does not run when isActive returns true", async () => {
    const { importer, sqlite } = createTestImporter();
    try {
      const onResolved = mock(() => {});
      const service = new BackgroundRetryService({
        animeImporter: importer,
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
    const { animeRepo, importer, sqlite } = createTestImporter();
    try {
      animeRepo.upsertAnime({ title: "Pending Anime" });

      const onResolved = mock(() => {});
      const service = new BackgroundRetryService({
        animeImporter: importer,
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
    const { importer, sqlite } = createTestImporter();
    try {
      const service = new BackgroundRetryService({
        animeImporter: importer,
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
    const { importer, sqlite } = createTestImporter();
    try {
      const service = new BackgroundRetryService({
        animeImporter: importer,
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
