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
    test("throws on non-JSON HTTP error response", async () => {
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

    test("throws on non-JSON HTTP 404 response", async () => {
      const httpClient = createMockHttpClient(async () => {
        return new Response(null, {
          status: 404,
          statusText: "Not Found",
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      await expect(provider.searchByTitle("Test")).rejects.toThrow(
        "AniList API error: 404 Not Found",
      );
    });

    test("throws on GraphQL error response without data", async () => {
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

    test("returns partial data when AniList returns 404 with errors and data", async () => {
      const mockResponse = {
        errors: [
          { message: "Not Found.", status: 404, locations: [{ line: 43, column: 5 }] },
          { message: "Not Found.", status: 404, locations: [{ line: 63, column: 5 }] },
        ],
        data: {
          Media1: {
            id: 12345,
            title: { romaji: "Jujutsu Kaisen", english: null, native: null },
            format: "TV",
            episodes: 24,
            relations: { edges: [] },
            externalLinks: null,
          },
          Media2: null,
          Media3: null,
          Media4: null,
        },
      };

      const httpClient = createMockHttpClient(async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json" },
        });
      });

      const provider = new AniListEnrichmentProvider("https://graphql.anilist.co", httpClient);

      const results = await provider.getMediaDetailsBatch(["12345", "99998", "99999", "99997"]);

      expect(results.length).toBe(4);
      expect(results[0]?.anilistId).toBe("12345");
      expect(results[0]?.title).toBe("Jujutsu Kaisen");
      expect(results[1]?.title).toBe("Unknown 99998");
      expect(results[2]?.title).toBe("Unknown 99999");
      expect(results[3]?.title).toBe("Unknown 99997");
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
