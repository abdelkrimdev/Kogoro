import { describe, expect, test } from "bun:test";
import { makeConfig } from "../fixtures";
import { tomlStringify } from "./toml-serializer";

describe("tomlStringify", () => {
  test("serializes top-level string values", () => {
    const config = makeConfig({ "primary-db": "anidb" });
    const result = tomlStringify(config);
    expect(result).toContain('primary-db = "anidb"');
  });

  test("serializes top-level number values", () => {
    const config = makeConfig({
      "scan-concurrency": 8,
      "fetch-concurrency": 3,
    });
    const result = tomlStringify(config);
    expect(result).toContain("scan-concurrency = 8");
    expect(result).toContain("fetch-concurrency = 3");
  });

  test("serializes episode-numbering value", () => {
    const config = makeConfig({ "episode-numbering": "absolute" });
    const result = tomlStringify(config);
    expect(result).toContain('episode-numbering = "absolute"');
  });

  test("serializes array values", () => {
    const config = makeConfig({
      "media-extensions": [".mkv", ".mp4"],
      "exclude-patterns": [".part", ".crdownload"],
    });
    const result = tomlStringify(config);
    expect(result).toContain('media-extensions = [".mkv", ".mp4"]');
    expect(result).toContain('exclude-patterns = [".part", ".crdownload"]');
  });

  test("serializes empty arrays", () => {
    const config = makeConfig({ "media-extensions": [] });
    const result = tomlStringify(config);
    expect(result).toContain("media-extensions = []");
  });

  test("serializes template section", () => {
    const config = makeConfig({
      template: {
        preset: "plex",
        custom: "",
        directory: "{anime}/{type}",
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain("[template]");
    expect(result).toContain('preset = "plex"');
    expect(result).toContain('directory = "{anime}/{type}"');
  });

  test("serializes template with custom preset", () => {
    const config = makeConfig({
      template: {
        preset: "custom",
        custom: "{anime} - {title}",
        directory: "Anime",
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain('preset = "custom"');
    expect(result).toContain('custom = "{anime} - {title}"');
  });

  test("serializes plugins section", () => {
    const config = makeConfig({
      plugins: {
        tvdb: { enabled: true },
        anidb: { enabled: false },
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain("[plugins.tvdb]");
    expect(result).toContain("enabled = true");
    expect(result).toContain("[plugins.anidb]");
    expect(result).toContain("enabled = false");
  });

  test("serializes sanitize section", () => {
    const config = makeConfig({
      sanitize: {
        action: "replace",
        replacement: "_",
        chars: '\\/:*?"<>|',
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain("[sanitize]");
    expect(result).toContain('action = "replace"');
    expect(result).toContain('replacement = "_"');
  });

  test("serializes a complete config", () => {
    const config = makeConfig({
      "primary-db": "tvdb",
      "scan-concurrency": 4,
      "episode-numbering": "relative",
      template: {
        preset: "standard",
        custom: "",
        directory: "{anime}/{type}",
      },
      plugins: {
        tvdb: { enabled: true },
      },
      sanitize: {
        action: "strip",
        replacement: "_",
        chars: '\\/:*?"<>|',
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain('primary-db = "tvdb"');
    expect(result).toContain("scan-concurrency = 4");
    expect(result).toContain("[template]");
    expect(result).toContain("[plugins.tvdb]");
    expect(result).toContain("[sanitize]");
  });

  test("escapes strings with double quotes", () => {
    const config = makeConfig({
      template: {
        preset: "custom",
        custom: 'he said "hello"',
        directory: "",
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain('custom = "he said \\"hello\\""');
  });

  test("escapes strings with newlines", () => {
    const config = makeConfig({
      template: {
        preset: "custom",
        custom: "line1\nline2",
        directory: "",
      },
    });
    const result = tomlStringify(config);
    expect(result).toContain('custom = "line1\\nline2"');
  });

  test("ends with trailing newline", () => {
    const config = makeConfig();
    const result = tomlStringify(config);
    expect(result.endsWith("\n")).toBe(true);
  });

  test("separates sections with blank lines", () => {
    const config = makeConfig({
      "primary-db": "tvdb",
      template: {
        preset: "standard",
        custom: "",
        directory: "",
      },
      plugins: {
        tvdb: { enabled: true },
      },
      sanitize: {
        action: "strip",
        replacement: "_",
        chars: "",
      },
    });
    const result = tomlStringify(config);
    const lines = result.split("\n");
    const templateIdx = lines.indexOf("[template]");
    const pluginIdx = lines.indexOf("[plugins.tvdb]");
    const sanitizeIdx = lines.indexOf("[sanitize]");
    expect(templateIdx).toBeGreaterThan(0);
    expect(pluginIdx).toBeGreaterThan(templateIdx);
    expect(sanitizeIdx).toBeGreaterThan(pluginIdx);
  });
});
