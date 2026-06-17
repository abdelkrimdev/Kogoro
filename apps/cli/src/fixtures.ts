import type {
  ConfigManager,
  DatabasePlugin,
  EntryType,
  EpisodeResult,
  OverrideStore,
  SubtitlePlugin,
} from "@kogoro/core";
import { createMatchCacheService } from "@kogoro/core/testing";
import { createScanHandlers } from "./scan/handlers";

export function captureStreams() {
  const stdoutMessages: string[] = [];
  const stderrMessages: string[] = [];
  let exitCode: number | undefined;

  return {
    stdout: (msg: string) => stdoutMessages.push(msg),
    stderr: (msg: string) => stderrMessages.push(msg),
    exit: (code: number) => {
      exitCode = code;
    },
    stdoutMessages,
    stderrMessages,
    exitCode: () => exitCode,
  };
}

export async function captureConsoleLogAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; logs: string[] }> {
  const origLog = console.log;
  const logs: string[] = [];
  console.log = (msg: string) => logs.push(msg);
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.log = origLog;
  }
}

export function makeMockLogger(): {
  logger: {
    info(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
    progress(msg: string): void;
  };
  infoLines: string[];
  errorLines: string[];
  debugLines: string[];
  progressLines: string[];
} {
  const infoLines: string[] = [];
  const errorLines: string[] = [];
  const debugLines: string[] = [];
  const progressLines: string[] = [];
  return {
    logger: {
      info(msg: string) {
        infoLines.push(msg);
      },
      error(msg: string) {
        errorLines.push(msg);
      },
      debug(msg: string) {
        debugLines.push(msg);
      },
      progress(msg: string) {
        progressLines.push(msg);
      },
    },
    infoLines,
    errorLines,
    debugLines,
    progressLines,
  };
}

export function makeThrowingDb(): DatabasePlugin {
  return {
    async searchAnime() {
      throw new Error("Should not be called");
    },
    async getEpisodes() {
      throw new Error("Should not be called");
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

export function createMockSubtitlePlugin(
  opts: {
    searchResults?: Array<{
      id: string;
      fileId: number;
      language: string;
      format: string;
      score: number;
      fileName: string;
    }>;
    downloadContent?: string;
  } = {},
): SubtitlePlugin {
  return {
    async search() {
      return (
        opts.searchResults ?? [
          {
            id: "sub1",
            fileId: 101,
            language: "en",
            format: "srt",
            score: 5000,
            fileName: "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.srt",
          },
        ]
      );
    },
    async download() {
      return opts.downloadContent ?? "1\n00:00:01,000 --> 00:00:05,000\nHello world\n";
    },
  };
}

export function createStandardMockDb(overrides?: {
  searchAnime?: (title: string) => Array<{ id: string; titleEn: string; entryType: EntryType }>;
  getEpisodes?: (animeId: string) => EpisodeResult[];
}): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return (
        overrides?.searchAnime?.(title) ?? [
          { id: "12345", titleEn: title, entryType: "tv" as EntryType },
        ]
      );
    },
    async getEpisodes(animeId: string) {
      return (
        overrides?.getEpisodes?.(animeId) ?? [
          {
            id: "1001",
            animeId: "12345",
            season: 1,
            episode: 1,
            titleEn: "Ryomen Sukuna",
            airDate: "2020-10-03",
            entryType: "tv" as EntryType,
          },
        ]
      );
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

export function createMockPlugin(): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      if (title === "Jujutsu Kaisen") {
        return [
          {
            id: "12345",
            titleEn: "Jujutsu Kaisen",
            titleJa: "呪術廻戦",
            overview: "A boy fights curses.",
            year: 2020,
            entryType: "tv" as EntryType,
          },
        ];
      }
      return [];
    },
    async getEpisodes(animeId: string) {
      if (animeId === "12345") {
        return [
          {
            id: "1001",
            animeId: "12345",
            season: 1,
            episode: 1,
            titleEn: "Ryomen Sukuna",
            airDate: "2020-10-03",
            entryType: "tv" as EntryType,
          },
        ];
      }
      return [];
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

export function createTestHandlers(overrides?: {
  database?: ReturnType<typeof createStandardMockDb>;
  cacheService?: ReturnType<typeof createMatchCacheService>["cacheService"];
  overrideStore?: OverrideStore;
  config?: ConfigManager;
}) {
  const { cacheService } = overrides?.cacheService
    ? { cacheService: overrides.cacheService }
    : createMatchCacheService();
  return createScanHandlers({
    database: overrides?.database ?? createStandardMockDb(),
    cacheService,
    overrideStore: overrides?.overrideStore,
    config: overrides?.config,
  });
}
