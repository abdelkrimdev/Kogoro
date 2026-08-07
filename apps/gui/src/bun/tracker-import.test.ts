import { describe, expect, test } from "bun:test";
import { AnimeImporter, ConfigManager, CredentialStore } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepositories,
  createMockIdentityResolver,
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
    test("returns preview for anilist tracker", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories();
      const { close: closeEvt } = createEventRepository();
      try {
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          resolveAndMerge: async () => ({ animeIds: [] }),
        });

        await withMockFetch(mockAnilistFetch() as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            animeImporter: importer,
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

    test("returns error for unknown tracker", async () => {
      const factory = createTestFactory();
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories();
      const { close: closeEvt } = createEventRepository();
      try {
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          resolveAndMerge: async () => ({ animeIds: [] }),
        });
        const handlers = createTrackerImportHandlers({
          animeImporter: importer,
          pluginFactory: factory,
        });

        const result = await handlers.getImportPreview({ trackerName: "nonexistent" });

        expect(result.preview).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        closeEvt();
        close();
      }
    });

    test("returns unmatched entries as flat list", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories();
      const { close: closeEvt } = createEventRepository();
      try {
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          resolveAndMerge: async () => ({ animeIds: [] }),
        });

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
            animeImporter: importer,
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
    test("returns result for anilist tracker", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories();
      const { close: closeEvt } = createEventRepository();
      try {
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          resolveAndMerge: async () => ({ animeIds: [] }),
        });

        await withMockFetch(mockAnilistFetch() as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            animeImporter: importer,
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

    test("returns error for unknown tracker", async () => {
      const factory = createTestFactory();
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories();
      const { close: closeEvt } = createEventRepository();
      try {
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          resolveAndMerge: async () => ({ animeIds: [] }),
        });
        const handlers = createTrackerImportHandlers({
          animeImporter: importer,
          pluginFactory: factory,
        });

        const result = await handlers.confirmImport({ trackerName: "nonexistent" });

        expect(result.result).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        closeEvt();
        close();
      }
    });

    test("reuses cached tracker list from preview to confirm", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories();
      const { close: closeEvt } = createEventRepository();
      try {
        const importer = new AnimeImporter({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
          resolveAndMerge: async () => ({ animeIds: [] }),
        });

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
            animeImporter: importer,
            pluginFactory: factory,
          });

          const preview = await handlers.getImportPreview({ trackerName: "anilist" });
          expect(preview.error).toBeUndefined();
          expect(preview.preview?.totalEntries).toBe(1);

          const result = await handlers.confirmImport({ trackerName: "anilist" });
          expect(result.error).toBeUndefined();
          expect(result.result?.imported).toBe(1);
        });
      } finally {
        closeEvt();
        close();
      }
    });
  });
});
