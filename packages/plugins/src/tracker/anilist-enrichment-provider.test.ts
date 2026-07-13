import { describe, expect, test } from "bun:test";
import { createMockHttpClient } from "@kogoro/core/testing";
import { AniListEnrichmentProvider } from "./anilist-enrichment-provider";

describe("AniListEnrichmentProvider", () => {
  describe("searchByTitle", () => {
    test("returns search result from AniList API", async () => {
      const mockResponse = {
        data: {
          Media: {
            id: 12345,
            title: { romaji: "Jujutsu Kaisen", english: null, native: null },
            format: "TV",
            episodes: 24,
          },
        },
      };

      const httpClient = createMockHttpClient(async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      const result = await provider.searchByTitle("Jujutsu Kaisen");

      expect(result).not.toBeNull();
      expect(result?.anilistId).toBe("12345");
      expect(result?.title).toBe("Jujutsu Kaisen");
      expect(result?.format).toBe("TV");
      expect(result?.episodes).toBe(24);
    });

    test("returns null when no media found", async () => {
      const mockResponse = {
        data: {
          Media: null,
        },
      };

      const httpClient = createMockHttpClient(async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      const result = await provider.searchByTitle("Nonexistent Anime");

      expect(result).toBeNull();
    });
  });

  describe("getMediaDetailsBatch", () => {
    test("returns media details with relations", async () => {
      const mockResponse = {
        data: {
          Media1: {
            id: 12345,
            title: { romaji: "Jujutsu Kaisen", english: null, native: null },
            format: "TV",
            episodes: 24,
            relations: {
              edges: [
                {
                  relationType: "SEQUEL",
                  node: {
                    id: 12346,
                    title: { romaji: "Jujutsu Kaisen Season 2", english: null, native: null },
                    format: "TV",
                  },
                },
              ],
            },
            externalLinks: [{ site: "ANILIST", id: "12345" }],
          },
          Media2: {
            id: 12346,
            title: { romaji: "Jujutsu Kaisen Season 2", english: null, native: null },
            format: "TV",
            episodes: 23,
            relations: {
              edges: [
                {
                  relationType: "PREQUEL",
                  node: {
                    id: 12345,
                    title: { romaji: "Jujutsu Kaisen", english: null, native: null },
                    format: "TV",
                  },
                },
              ],
            },
            externalLinks: null,
          },
        },
      };

      const httpClient = createMockHttpClient(async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      const results = await provider.getMediaDetailsBatch(["12345", "12346"]);

      expect(results.length).toBe(2);

      const result0 = results[0];
      const result1 = results[1];
      expect(result0).toBeDefined();
      expect(result1).toBeDefined();

      expect(result0?.anilistId).toBe("12345");
      expect(result0?.title).toBe("Jujutsu Kaisen");
      expect(result0?.relations.length).toBe(1);
      expect(result0?.relations[0]?.relationType).toBe("SEQUEL");
      expect(result0?.externalLinks).toEqual([{ site: "ANILIST", id: "12345" }]);

      expect(result1?.anilistId).toBe("12346");
      expect(result1?.title).toBe("Jujutsu Kaisen Season 2");
      expect(result1?.relations.length).toBe(1);
      expect(result1?.relations[0]?.relationType).toBe("PREQUEL");
      expect(result1?.externalLinks).toBeUndefined();
    });

    test("returns empty array for empty input", async () => {
      const httpClient = createMockHttpClient(async () => {
        return new Response("{}", { status: 200 });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      const results = await provider.getMediaDetailsBatch([]);

      expect(results).toEqual([]);
    });
  });

  describe("error handling", () => {
    test("throws on HTTP error response", async () => {
      const httpClient = createMockHttpClient(async () => {
        return new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      await expect(provider.searchByTitle("Test")).rejects.toThrow(
        "AniList API error: 500 Internal Server Error",
      );
    });

    test("throws on GraphQL error response", async () => {
      const mockResponse = {
        data: null,
        errors: [{ message: "Rate limit exceeded" }],
      };

      const httpClient = createMockHttpClient(async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      await expect(provider.searchByTitle("Test")).rejects.toThrow(
        "AniList GraphQL error: Rate limit exceeded",
      );
    });

    test("throws on network error", async () => {
      const httpClient = createMockHttpClient(async () => {
        throw new Error("Network connection failed");
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      await expect(provider.searchByTitle("Test")).rejects.toThrow("Network connection failed");
    });

    test("includes Authorization header when token is provided", async () => {
      let capturedHeaders: Record<string, string> = {};
      const httpClient = createMockHttpClient(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return new Response(JSON.stringify({ data: { Media: null } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const provider = new AniListEnrichmentProvider(
        "https://graphql.anilist.co",
        httpClient,
        "test-token-123",
      );

      await provider.searchByTitle("Test");

      expect(capturedHeaders["Authorization"]).toBe("Bearer test-token-123");
    });
  });
});
