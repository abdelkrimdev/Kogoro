import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import * as v from "valibot";
import {
  CONFIG_DIR,
  type Config,
  ConfigSchema,
  ENTRY_TYPE_DIR_MAP,
  ORGANIZED_DIRS,
  TEMPLATE_PRESETS,
} from "./schema";

describe("ConfigSchema", () => {
  describe("validates known-good config", () => {
    test("accepts a complete valid config object", () => {
      const config = {
        "primary-db": "tvdb",
        template: {
          preset: "plex",
          custom: "Custom - {title}",
          directory: "{anime}/Season {season}",
        },
        "media-extensions": [".mkv", ".mp4"],
        "exclude-patterns": [".part"],
        "scan-concurrency": 2,
        "fetch-concurrency": 3,
        "episode-numbering": "absolute",
        "rename-action": "copy",
        "subtitle-language": "fr",
        plugins: {
          tvdb: { enabled: true },
          anidb: { enabled: false },
          opensubtitles: { enabled: true },
        },
        sanitize: { action: "replace" as const, replacement: "_", chars: '\\/:*?"<>|' },
      } satisfies Config;

      const result = v.safeParse(ConfigSchema, config);
      expect(result.success).toBe(true);
    });

    test("accepts minimal valid config", () => {
      const config = {
        "primary-db": "anidb",
        template: { preset: "compact" },
        plugins: {
          tvdb: { enabled: false },
          anidb: { enabled: true },
          opensubtitles: { enabled: true },
        },
      };

      const result = v.safeParse(ConfigSchema, config);
      expect(result.success).toBe(true);
    });
  });

  describe("rejects invalid types", () => {
    test("rejects string for scan-concurrency", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        "scan-concurrency": "eight",
      });
      expect(result.success).toBe(false);
    });

    test("rejects string for fetch-concurrency", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        "fetch-concurrency": "five",
      });
      expect(result.success).toBe(false);
    });

    test("rejects number for media-extensions", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        "media-extensions": 123,
      });
      expect(result.success).toBe(false);
    });

    test("rejects number for primary-db", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        "primary-db": 42,
      });
      expect(result.success).toBe(false);
    });

    test("rejects string for plugins.tvdb.enabled", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        plugins: {
          tvdb: { enabled: "yes" },
          anidb: { enabled: true },
          opensubtitles: { enabled: true },
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("rejects unknown keys", () => {
    test("rejects unknown top-level keys", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        unknownKey: "value",
      });
      expect(result.success).toBe(false);
    });

    test("rejects unknown keys inside template object", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        template: {
          preset: "standard",
          custom: "",
          directory: "{anime}/{type}",
          unknownField: "x",
        },
      });
      expect(result.success).toBe(false);
    });

    test("rejects unknown keys inside plugins object", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        plugins: {
          tvdb: { enabled: true, extraProp: true },
          anidb: { enabled: true },
          opensubtitles: { enabled: true },
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("fills in defaults", () => {
    test("empty object gets all defaults", () => {
      const result = v.safeParse(ConfigSchema, {});
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.output["primary-db"]).toBe("tvdb");
      expect(result.output.template.preset).toBe("standard");
      expect(result.output.template.custom).toBe("");
      expect(result.output.template.directory).toBe("{anime}/{type}");
      expect(result.output["media-extensions"]).toEqual([
        ".mkv",
        ".mp4",
        ".avi",
        ".mov",
        ".wmv",
        ".flv",
        ".webm",
        ".ogm",
        ".m4v",
      ]);
      expect(result.output["exclude-patterns"]).toEqual([".part", ".crdownload", "!qb"]);
      expect(result.output["scan-concurrency"]).toBe(4);
      expect(result.output["fetch-concurrency"]).toBe(5);
      expect(result.output["episode-numbering"]).toBe("relative");
      expect(result.output["rename-action"]).toBe("move");
      expect(result.output["subtitle-language"]).toBe("en");
      expect(result.output.plugins.tvdb.enabled).toBe(true);
      expect(result.output.plugins.anidb.enabled).toBe(true);
      expect(result.output.plugins.opensubtitles.enabled).toBe(true);
      expect(result.output.sanitize.action).toBe("strip");
      expect(result.output.sanitize.replacement).toBe("_");
      expect(result.output.sanitize.chars).toBe('\\/:*?"<>|');
    });

    test("partial input fills missing keys from defaults", () => {
      const result = v.safeParse(ConfigSchema, {
        "primary-db": "anidb",
        "scan-concurrency": 8,
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.output["primary-db"]).toBe("anidb");
      expect(result.output["scan-concurrency"]).toBe(8);
      expect(result.output["fetch-concurrency"]).toBe(5);
      expect(result.output["episode-numbering"]).toBe("relative");
    });
  });

  describe("validates enum-like fields", () => {
    test("rejects invalid template preset", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        template: { preset: "invalid-preset" },
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid episode-numbering value", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        "episode-numbering": "sequential",
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid rename-action value", () => {
      const result = v.safeParse(ConfigSchema, {
        ...validConfig(),
        "rename-action": "delete",
      });
      expect(result.success).toBe(false);
    });

    test("accepts all valid template presets", () => {
      for (const preset of [
        "standard",
        "compact",
        "absolute",
        "plex",
        "anidb",
        "custom",
      ] as const) {
        const result = v.safeParse(ConfigSchema, {
          ...validConfig(),
          template: { preset },
        });
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("TEMPLATE_PRESETS", () => {
  test("contains all five preset templates", () => {
    expect(Object.keys(TEMPLATE_PRESETS)).toEqual([
      "standard",
      "compact",
      "absolute",
      "plex",
      "anidb",
    ]);
  });

  test("each preset resolves to a non-empty string", () => {
    for (const template of Object.values(TEMPLATE_PRESETS)) {
      expect(template.length).toBeGreaterThan(0);
    }
  });
});

describe("ENTRY_TYPE_DIR_MAP", () => {
  test("maps all entry types to directory names", () => {
    expect(ENTRY_TYPE_DIR_MAP).toEqual({
      tv: "TV",
      movie: "Movies",
      ova: "OVA",
      special: "Specials",
    });
  });
});

describe("ORGANIZED_DIRS", () => {
  test("contains all directory names from entry type map", () => {
    expect(ORGANIZED_DIRS).toEqual(new Set(["TV", "Movies", "OVA", "Specials"]));
  });
});

describe("CONFIG_DIR", () => {
  test("points to ~/.config/kogoro", () => {
    expect(CONFIG_DIR).toBe(join(homedir(), ".config", "kogoro"));
  });
});

function validConfig(): Config {
  return {
    "primary-db": "tvdb",
    template: { preset: "standard", custom: "", directory: "{anime}/{type}" },
    "media-extensions": [".mkv", ".mp4"],
    "exclude-patterns": [".part"],
    "scan-concurrency": 4,
    "fetch-concurrency": 5,
    "episode-numbering": "relative",
    "rename-action": "move",
    "subtitle-language": "en",
    plugins: {
      tvdb: { enabled: true },
      anidb: { enabled: true },
      opensubtitles: { enabled: true },
    },
    sanitize: { action: "replace", replacement: "_", chars: '\\/:*?"<>|' },
  };
}
