import { describe, expect, test } from "bun:test";
import { OpenSubtitlesPlugin } from "./opensubtitles-plugin";

function mockFetch(data: unknown, status = 200) {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("OpenSubtitlesPlugin", () => {
  test("search returns subtitle results for a query", async () => {
    const searchResponse = {
      data: [
        {
          id: "abc123",
          type: "subtitle",
          attributes: {
            subtitle_id: 42,
            language: "en",
            download_count: 5000,
            file_id: 101,
          },
        },
      ],
    };

    const adapter = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockFetch(searchResponse),
    });

    const results = await adapter.search("Jujutsu Kaisen", 1, 1, "en");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("abc123");
    expect(results[0]?.fileId).toBe(101);
    expect(results[0]?.language).toBe("en");
  });

  test("search returns empty array for no results", async () => {
    const searchResponse = { data: [] };

    const adapter = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockFetch(searchResponse),
    });

    const results = await adapter.search("Unknown Anime", 1, 1, "en");
    expect(results).toEqual([]);
  });

  test("search returns empty array on API error", async () => {
    const adapter = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockFetch(null, 401),
    });

    const results = await adapter.search("Jujutsu Kaisen", 1, 1, "en");
    expect(results).toEqual([]);
  });

  test("download returns subtitle content", async () => {
    const downloadResponse = {
      link: "https://dl.opensubtitles.com/file.srt",
      file_name: "file.srt",
    };
    const contentResponse = "1\n00:00:01,000 --> 00:00:05,000\nHello world\n";

    let callCount = 0;
    const adapter = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: async (_url: string | URL, _init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(downloadResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(contentResponse, { status: 200 });
      },
    });

    const content = await adapter.download(101);
    expect(content).toBe(contentResponse);
    expect(callCount).toBe(2);
  });

  test("download returns empty string on API error", async () => {
    const adapter = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockFetch(null, 500),
    });

    const content = await adapter.download(101);
    expect(content).toBe("");
  });
});
