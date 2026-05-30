export { ArtworkFetcher } from "./artwork-fetcher";
export type { KeytarLike } from "./config/bun-secrets-keytar";
export { BunSecretsKeytar } from "./config/bun-secrets-keytar";
export type { SetResult } from "./config/config-manager";
export { ConfigManager } from "./config/config-manager";
export type { PromptsAPI } from "./config/config-wizard";
export { getDefaultPrompts, runConfigWizard } from "./config/config-wizard";
export { CredentialStore, createCredentialStore } from "./config/credential-store";
export type { Config, EpisodeNumbering } from "./config/schema";
export {
  CONFIG_DIR,
  ConfigSchema,
  ENTRY_TYPE_DIR_MAP,
  ORGANIZED_DIRS,
  SCHEMA_DEFAULTS,
  TEMPLATE_PRESETS,
} from "./config/schema";

export { walk } from "./directory-walker";
export type { DebugEntry } from "./http-client";
export { HttpClient } from "./http-client";
export type { LibraryAnime, LibraryEpisode, WatchStatus } from "./library-db";
export { LibraryDb } from "./library-db";
export type { CachedMatch } from "./match-cache";
export { MatchCache } from "./match-cache";
export type { MatcherLike, MatchResult } from "./matcher";
export {
  AMBIGUOUS_MATCH_REASON,
  bestPerAnimeId,
  isClearWinner,
  Matcher,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
  resolveEpisode,
} from "./matcher";
export { MetadataWriter } from "./metadata-writer";
export { absoluteToRelative, relativeToAbsolute } from "./numbering-converter";
export type { OverrideData } from "./override-store";
export { OVERRIDE_TOML_KEYS, OverrideStore } from "./override-store";
export type { ParsedResult, ParsedTags } from "./parser";
export { createEmptyResult, parse, stripExtension } from "./parser";
export type {
  ProgressEvent,
  ProgressTracker,
  ProgressTrackerOptions,
  TaskContext,
} from "./progress";
export type {
  AnimeGroup,
  AnimeGroupEntry,
  ReviewPlan,
  SwapPair,
} from "./rename-plan-aggregator";
export { buildReviewPlan, detectSwaps, groupByAnime } from "./rename-plan-aggregator";
export type { RenameAction, RenamePlan, RenameResult } from "./renamer";
export { Renamer } from "./renamer";
export type { ScanResult } from "./scanner";
export { computeFileHash, getDirectoryTitle, Scanner } from "./scanner";
export { render } from "./template-engine";
export {
  captureConsoleLog,
  createAmbiguousMatcher,
  createArtworkDb,
  createCache,
  createCallCounter,
  createCountingFetch,
  createDataMockDb,
  createEpisodeNumberingMatcher,
  createLibraryDb,
  createLogCapture,
  createMockClackPrompts,
  createMockDb,
  createMockHttpClient,
  createMockKeytar,
  createMockMatcher,
  createMockResponse,
  createMockSubtitlePlugin,
  createSequenceFetch,
  createSequenceHttpClient,
  createStandardMockDb,
  createTrackingFetch,
  createTrackingMatcher,
  makeCachedMatch,
  makeEpisodes,
  makeMatchResult,
  makeNoMatchResult,
  makeParsedResult,
  makeThrowingDb,
  mockFetch,
  mockJsonFetch,
  seedCacheEntry,
  silentBunSecrets,
  stubBunSecrets,
  testImageBytes,
  toUrlString,
  withMockFetch,
  withTempDir,
  withTestConfig,
  writeTempFile,
} from "./test-fixtures";
export type {
  AnimeResult,
  ArtworkResult,
  ArtworkType,
  DatabasePlugin,
  EntryType,
  EpisodeResult,
  SubtitlePlugin,
  SubtitleResult,
} from "./types";
