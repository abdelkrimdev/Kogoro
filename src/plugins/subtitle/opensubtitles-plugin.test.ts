import { describe, expect, test } from "bun:test";
import { createCallCounter, mockJsonFetch } from "../../test-helpers";
import { OpenSubtitlesPlugin } from "./opensubtitles-plugin";

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

    const plugin = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockJsonFetch(searchResponse),
    });

    const results = await plugin.search("Jujutsu Kaisen", 1, 1, "en");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("abc123");
    expect(results[0]?.fileId).toBe(101);
    expect(results[0]?.language).toBe("en");
  });

  test("search returns empty array for no results", async () => {
    const searchResponse = { data: [] };

    const plugin = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockJsonFetch(searchResponse),
    });

    const results = await plugin.search("Unknown Anime", 1, 1, "en");
    expect(results).toEqual([]);
  });

  test("search returns empty array on API error", async () => {
    const plugin = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockJsonFetch(null, 401),
    });

    const results = await plugin.search("Jujutsu Kaisen", 1, 1, "en");
    expect(results).toEqual([]);
  });

  test("download returns subtitle content", async () => {
    const downloadResponse = {
      link: "https://dl.opensubtitles.com/file.srt",
      file_name: "file.srt",
    };
    const contentResponse = "1\n00:00:01,000 --> 00:00:05,000\nHello world\n";

    const calls = createCallCounter();
    const plugin = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: async (_url: string | URL, _init?: RequestInit) => {
        calls.inc();
        if (calls.get() === 1) {
          return new Response(JSON.stringify(downloadResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(contentResponse, { status: 200 });
      },
    });

    const content = await plugin.download(101);
    expect(content).toBe(contentResponse);
    expect(calls.get()).toBe(2);
  });

  test("download returns empty string on API error", async () => {
    const plugin = new OpenSubtitlesPlugin({
      apiKey: "test-key",
      fetch: mockJsonFetch(null, 500),
    });

    const content = await plugin.download(101);
    expect(content).toBe("");
  });
});
