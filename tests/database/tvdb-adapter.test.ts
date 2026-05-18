import { describe, expect, test } from "bun:test";
import { TVDBAdapter } from "../../src/database/tvdb-adapter.ts";

function createMockFetch(responses: (unknown | Response)[]) {
  let callIndex = 0;
  return async () => {
    const data = responses[callIndex];
    callIndex++;
    if (data instanceof Response) return data;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("TVDBAdapter", () => {
  test("searchAnime returns AnimeResult[] from TVDB API", async () => {
    const adapter = new TVDBAdapter({
      apiKey: "test-key",
      fetch: createMockFetch([
        { token: "mock-token" },
        {
          data: [
            {
              id: 123,
              name: "Jujutsu Kaisen",
              year: "2020",
              image: "https://example.com/image.jpg",
              overview: "A boy fights curses.",
            },
          ],
        },
      ]),
    });

    const results = await adapter.searchAnime("Jujutsu Kaisen");

    expect(results).toHaveLength(1);
    const first = results[0] as NonNullable<(typeof results)[0]>;
    expect(first.id).toBe("123");
    expect(first.title).toBe("Jujutsu Kaisen");
    expect(first.year).toBe(2020);
    expect(first.image).toBe("https://example.com/image.jpg");
    expect(first.overview).toBe("A boy fights curses.");
  });

  test("getEpisodes returns EpisodeResult[] with entryType mapped from TVDB type", async () => {
    const adapter = new TVDBAdapter({
      apiKey: "test-key",
      fetch: createMockFetch([
        { token: "mock-token" },
        {
          data: [
            {
              id: 1,
              name: "Episode 1",
              seasonNumber: 1,
              number: 1,
              type: { id: 1, name: "Regular Episode" },
              airDate: "2020-10-03",
              overview: "First episode",
            },
            {
              id: 2,
              name: "Episode 2",
              seasonNumber: 1,
              number: 2,
              type: { id: 5, name: "Movie" },
              airDate: "2020-10-10",
            },
            {
              id: 3,
              name: "Special Episode",
              seasonNumber: 1,
              number: 0,
              type: { id: 6, name: "Special" },
            },
          ],
        },
      ]),
    });

    const results = await adapter.getEpisodes("123");

    expect(results).toHaveLength(3);
    const ep1 = results[0] as NonNullable<(typeof results)[0]>;
    expect(ep1.id).toBe("1");
    expect(ep1.title).toBe("Episode 1");
    expect(ep1.seasonNumber).toBe(1);
    expect(ep1.episodeNumber).toBe(1);
    expect(ep1.entryType).toBe("TV");
    expect(ep1.airDate).toBe("2020-10-03");
    expect(ep1.overview).toBe("First episode");

    const ep2 = results[1] as NonNullable<(typeof results)[1]>;
    expect(ep2.entryType).toBe("Movie");
    expect(ep2.episodeNumber).toBe(2);

    const ep3 = results[2] as NonNullable<(typeof results)[2]>;
    expect(ep3.entryType).toBe("Special");
    expect(ep3.episodeNumber).toBe(0);
  });

  test("getArtwork returns ArtworkResult[] filtered by type", async () => {
    const adapter = new TVDBAdapter({
      apiKey: "test-key",
      fetch: createMockFetch([
        { token: "mock-token" },
        {
          data: [
            {
              id: 10,
              type: 2,
              image: "https://example.com/poster.jpg",
              width: 680,
              height: 1000,
            },
            {
              id: 11,
              type: 1,
              image: "https://example.com/fanart.jpg",
              width: 1920,
              height: 1080,
            },
            {
              id: 12,
              type: 2,
              image: "https://example.com/poster2.jpg",
            },
          ],
        },
      ]),
    });

    const results = await adapter.getArtwork("123", "poster");

    expect(results).toHaveLength(2);
    const art1 = results[0] as NonNullable<(typeof results)[0]>;
    expect(art1.id).toBe("10");
    expect(art1.url).toBe("https://example.com/poster.jpg");
    expect(art1.width).toBe(680);
    expect(art1.height).toBe(1000);

    const art2 = results[1] as NonNullable<(typeof results)[1]>;
    expect(art2.id).toBe("12");
    expect(art2.url).toBe("https://example.com/poster2.jpg");
  });

  test("handles TVDB API errors gracefully returning empty array", async () => {
    const adapter = new TVDBAdapter({
      apiKey: "test-key",
      fetch: createMockFetch([
        { token: "mock-token" },
        new Response("Internal Server Error", { status: 500 }),
      ]),
    });

    const results = await adapter.searchAnime("error-test");
    expect(results).toEqual([]);
  });
});
