import { describe, expect, test } from "bun:test";
import { createEventDb } from "../events/test-utils";
import { createMockIdentityResolver, createMockTracker } from "../fixtures";
import { AnimeImporter } from "./anime-importer";
import { createLibraryRepos } from "./schema";
import { createLibraryDb } from "./test-utils";

describe("AnimeImporter", () => {
  describe("importFromTracker", () => {
    test("creates new anime and episode groups for unmatched entries", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async (input) => {
            const animeIds: number[] = [];
            for (const entry of input.entries) {
              const anime = animeRepo.upsertAnime({ title: entry.title });
              animeIds.push(anime.id);
              const group = groupRepo.upsertEpisodeGroup({
                animeId: anime.id,
                entryType: entry.entryType,
                seasonNumber: entry.season ?? 1,
                watchStatus: "plan_to_watch",
              });
              if (entry.kind === "import") {
                groupRepo.upsertGroupTrackerMapping({
                  groupId: group.id,
                  source: entry.source,
                  externalId: entry.sourceId,
                });
              } else {
                for (const ep of entry.episodes) {
                  episodeRepo.upsertEpisodeFromMatch({
                    groupId: group.id,
                    episode: ep.episode,
                    filePath: ep.filePath,
                    title: ep.title,
                  });
                }
              }
            }
            return { animeIds };
          },
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 12,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await importer.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const animeList = animeRepo.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Attack on Titan");

        const groups = groupRepo.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("plan_to_watch");

        const mappings = groupRepo.getTrackerMappingsByGroupId(groups[0]?.id ?? 0);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("updates watch status for matched entries", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(new Map([["tl-1", "aot-anidb"]])),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const anime = animeRepo.upsertAnime({
          title: "Attack on Titan",
        });
        animeRepo.updateAnimeAnidbId(anime.id, "aot-anidb");

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await importer.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const updatedGroup = groupRepo.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        const mappings = groupRepo.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("skips entries that already have a tracker mapping", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const anime = animeRepo.upsertAnime({
          title: "Attack on Titan",
        });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        groupRepo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await importer.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(0);
        expect(result.skipped).toBe(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("applies user selections for conflict resolution", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(new Map([["tl-1", "aot-anidb"]])),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const anime = animeRepo.upsertAnime({
          title: "Attack on Titan",
        });
        animeRepo.updateAnimeAnidbId(anime.id, "aot-anidb");

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await importer.importFromTracker(tracker, "anilist", [
          { trackerId: "tl-1", groupId: group.id, resolution: "keepLocal" },
        ]);

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const updatedGroup = groupRepo.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("watching"); // kept local
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getImportPreview", () => {
    test("returns unmatched entries for new tracker items", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 12,
              totalEpisodes: 25,
            },
            {
              source: "anilist",
              trackerId: "tl-2",
              title: "Demon Slayer",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 26,
              totalEpisodes: 26,
            },
          ],
        });

        const preview = await importer.getImportPreview(tracker, "anilist");

        expect(preview.totalEntries).toBe(2);
        expect(preview.unmatched).toHaveLength(2);
        expect(preview.matched).toHaveLength(0);
        expect(preview.conflicts).toHaveLength(0);
        expect(preview.unmatched[0]?.title).toBe("Attack on Titan");
        expect(preview.unmatched[0]?.matchStatus).toBe("unmatched");
        expect(preview.statusCounts.watching).toBe(1);
        expect(preview.statusCounts.completed).toBe(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns matched entries when anime already exists", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime = animeRepo.upsertAnime({ title: "Attack on Titan" });
        animeRepo.updateAnimeAnidbId(anime.id, "anidb-111");
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "al-1",
        });

        const identityMap = new Map([["tl-1", "anidb-111"]]);
        const identityResolver = createMockIdentityResolver(identityMap);

        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver,
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 12,
              totalEpisodes: 25,
            },
          ],
        });

        const preview = await importer.getImportPreview(tracker, "anilist");

        expect(preview.totalEntries).toBe(1);
        expect(preview.matched).toHaveLength(1);
        expect(preview.matched[0]?.matchStatus).toBe("matched");
        expect(preview.matched[0]?.existingAnimeId).toBe(anime.id);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns conflicts when watch status differs", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime = animeRepo.upsertAnime({ title: "Attack on Titan" });
        animeRepo.updateAnimeAnidbId(anime.id, "anidb-111");
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "al-1",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        const identityMap = new Map([["tl-1", "anidb-111"]]);
        const identityResolver = createMockIdentityResolver(identityMap);

        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver,
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 12,
              totalEpisodes: 25,
            },
          ],
        });

        const preview = await importer.getImportPreview(tracker, "anilist");

        expect(preview.totalEntries).toBe(1);
        expect(preview.conflicts).toHaveLength(1);
        expect(preview.conflicts[0]?.matchStatus).toBe("conflict");
        expect(preview.conflicts[0]?.existingGroupId).toBe(group.id);
        expect(preview.conflicts[0]?.localWatchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("skips entries already linked to tracker", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const anime = animeRepo.upsertAnime({ title: "Already Linked" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        groupRepo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Already Linked",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 5,
              totalEpisodes: 12,
            },
          ],
        });

        const preview = await importer.getImportPreview(tracker, "anilist");

        expect(preview.totalEntries).toBe(0);
        expect(preview.matched).toHaveLength(0);
        expect(preview.unmatched).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("retryPendingIdentification", () => {
    test("finds anime with no AniDB ID", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const pendingAnime = animeRepo.upsertAnime({
          title: "Unknown Anime",
        });
        const resolvedAnime = animeRepo.upsertAnime({
          title: "Known Anime",
        });
        animeRepo.updateAnimeAnidbId(resolvedAnime.id, "al-123");

        const result = await importer.retryPendingIdentification();

        expect(result.resolved).toHaveLength(0);
        expect(result.stillPending).toHaveLength(1);
        expect(result.stillPending[0]?.id).toBe(pendingAnime.id);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("leaves anime pending when AniDB still unavailable", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        const pendingAnime = animeRepo.upsertAnime({
          title: "Still Unknown",
        });

        const result = await importer.retryPendingIdentification();

        expect(result.resolved).toHaveLength(0);
        expect(result.stillPending).toHaveLength(1);
        expect(result.stillPending[0]?.id).toBe(pendingAnime.id);

        const anime = animeRepo.getAnime(pendingAnime.id);
        expect(anime?.anidbId).toBeUndefined();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("skips when no library or cache match", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          merge: async () => ({ animeIds: [] }),
        });

        animeRepo.upsertAnime({
          title: "No Provider",
        });

        const result = await importer.retryPendingIdentification();

        expect(result.resolved).toHaveLength(0);
        expect(result.stillPending).toHaveLength(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });
});
