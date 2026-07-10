import { describe, expect, it } from "bun:test";
import { ConfigManager, CredentialStore, LibraryService } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepository,
  createMockKeytar,
  withMockFetch,
} from "@kogoro/core/testing";
import { PluginFactory } from "@kogoro/plugins";
import { createTrackerImportHandlers } from "./tracker-import";

function createTestFactory(credentials?: Record<string, string>): PluginFactory {
  const config = new ConfigManager();
  const credentialStore = new CredentialStore({
    keytar: createMockKeytar(credentials),
  });
  return new PluginFactory(config, credentialStore);
}

function mockAnilistFetch(
  listData: unknown = { data: { MediaListCollection: { lists: [] } } },
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { query: string };
    if (body.query.includes("Viewer")) {
      return new Response(JSON.stringify({ data: { Viewer: { id: 1 } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(listData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("TrackerImportHandlers", () => {
  describe("getImportPreview", () => {
    it("returns preview for anilist tracker", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        await withMockFetch(mockAnilistFetch() as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            libraryService,
            pluginFactory: factory,
          });
          const result = await handlers.getImportPreview({ trackerName: "anilist" });

          expect(result.error).toBeUndefined();
          expect(result.preview).not.toBeNull();
          expect(result.preview?.totalEntries).toBe(0);
        });
      } finally {
        closeEvt();
        close();
      }
    });

    it("returns error for unknown tracker", async () => {
      const factory = createTestFactory();
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);
        const handlers = createTrackerImportHandlers({ libraryService, pluginFactory: factory });

        const result = await handlers.getImportPreview({ trackerName: "nonexistent" });

        expect(result.preview).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        closeEvt();
        close();
      }
    });

    it("returns unmatched entries as flat list", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        const listData = {
          data: {
            MediaListCollection: {
              lists: [
                {
                  entries: [
                    {
                      mediaId: 1001,
                      status: "COMPLETED",
                      score: 0,
                      progress: 25,
                      media: {
                        title: {
                          romaji: "Shingeki no Kyojin Season 1",
                          english: "Attack on Titan Season 1",
                          native: null,
                        },
                        coverImage: { large: null },
                        startDate: { year: 2013 },
                        format: "TV",
                        episodes: 25,
                        synonyms: [],
                        relations: {
                          edges: [{ relationType: "SEQUEL", node: { id: 1002 } }],
                        },
                      },
                    },
                    {
                      mediaId: 1002,
                      status: "CURRENT",
                      score: 0,
                      progress: 10,
                      media: {
                        title: {
                          romaji: "Shingeki no Kyojin Season 2",
                          english: "Attack on Titan Season 2",
                          native: null,
                        },
                        coverImage: { large: null },
                        startDate: { year: 2017 },
                        format: "TV",
                        episodes: 12,
                        synonyms: [],
                        relations: {
                          edges: [{ relationType: "PREQUEL", node: { id: 1001 } }],
                        },
                      },
                    },
                    {
                      mediaId: 2001,
                      status: "COMPLETED",
                      score: 0,
                      progress: 37,
                      media: {
                        title: { romaji: "Death Note", english: "Death Note", native: null },
                        coverImage: { large: null },
                        startDate: { year: 2006 },
                        format: "TV",
                        episodes: 37,
                        synonyms: [],
                        relations: { edges: [] },
                      },
                    },
                  ],
                },
              ],
            },
          },
        };

        await withMockFetch(mockAnilistFetch(listData) as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            libraryService,
            pluginFactory: factory,
          });
          const result = await handlers.getImportPreview({ trackerName: "anilist" });

          expect(result.error).toBeUndefined();
          expect(result.preview).not.toBeNull();
          expect(result.preview?.totalEntries).toBe(3);
          expect(result.preview?.unmatched).toHaveLength(3);
          expect(
            result.preview?.unmatched.some((e) => e.title === "Shingeki no Kyojin Season 1"),
          ).toBe(true);
          expect(result.preview?.unmatched.some((e) => e.title === "Death Note")).toBe(true);
        });
      } finally {
        closeEvt();
        close();
      }
    });
  });

  describe("confirmImport", () => {
    it("returns result for anilist tracker", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        await withMockFetch(mockAnilistFetch() as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            libraryService,
            pluginFactory: factory,
          });
          const result = await handlers.confirmImport({ trackerName: "anilist" });

          expect(result.error).toBeUndefined();
          expect(result.result).not.toBeNull();
          expect(result.result?.imported).toBe(0);
        });
      } finally {
        closeEvt();
        close();
      }
    });

    it("returns error for unknown tracker", async () => {
      const factory = createTestFactory();
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);
        const handlers = createTrackerImportHandlers({ libraryService, pluginFactory: factory });

        const result = await handlers.confirmImport({ trackerName: "nonexistent" });

        expect(result.result).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        closeEvt();
        close();
      }
    });

    it("groups entries with same inferredAnimeTitle into one anime", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        const listData = {
          data: {
            MediaListCollection: {
              lists: [
                {
                  entries: [
                    {
                      mediaId: 1001,
                      status: "COMPLETED",
                      score: 0,
                      progress: 25,
                      media: {
                        title: {
                          romaji: "Attack on Titan Season 1",
                          english: "Attack on Titan Season 1",
                          native: null,
                        },
                        coverImage: { large: null },
                        startDate: { year: 2013 },
                        format: "TV",
                        episodes: 25,
                        synonyms: [],
                        relations: { edges: [] },
                      },
                    },
                    {
                      mediaId: 1002,
                      status: "CURRENT",
                      score: 0,
                      progress: 10,
                      media: {
                        title: {
                          romaji: "Attack on Titan Season 2",
                          english: "Attack on Titan Season 2",
                          native: null,
                        },
                        coverImage: { large: null },
                        startDate: { year: 2017 },
                        format: "TV",
                        episodes: 12,
                        synonyms: [],
                        relations: { edges: [] },
                      },
                    },
                  ],
                },
              ],
            },
          },
        };

        await withMockFetch(mockAnilistFetch(listData) as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            libraryService,
            pluginFactory: factory,
          });
          const result = await handlers.confirmImport({
            trackerName: "anilist",
            selections: [
              { trackerId: "1001", inferredAnimeTitle: "Attack on Titan" },
              { trackerId: "1002", inferredAnimeTitle: "Attack on Titan" },
            ],
          });

          expect(result.error).toBeUndefined();
          expect(result.result?.imported).toBe(2);

          const animeList = libraryService.listAnime();
          expect(animeList).toHaveLength(1);
          expect(animeList[0]?.title).toBe("Attack on Titan");

          const groups = libraryService.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
          expect(groups).toHaveLength(2);
        });
      } finally {
        closeEvt();
        close();
      }
    });
  });
});
