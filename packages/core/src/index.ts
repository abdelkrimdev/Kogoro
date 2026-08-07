export type { KeytarLike } from "./config/bun-secrets-keytar";
export { BunSecretsKeytar } from "./config/bun-secrets-keytar";
export type { KeyringCheckResult } from "./config/check-keyring";
export { checkKeyring } from "./config/check-keyring";
export type { SetResult } from "./config/config-manager";
export { ConfigManager } from "./config/config-manager";
export type { PromptsAPI } from "./config/config-wizard";
export { runConfigWizard } from "./config/config-wizard";
export { CredentialStore, createCredentialStore } from "./config/credential-store";
export type { LibraryConnection, MatchCacheConnection } from "./config/db-connection";
export {
  createEventsConnection,
  createLibraryConnection,
  createMatchCacheConnection,
} from "./config/db-connection";
export type { DbPaths } from "./config/db-paths";
export { resolveDbPaths } from "./config/db-paths";
export type { Config, EpisodeNumbering } from "./config/schema";
export {
  CONFIG_DIR,
  ConfigSchema,
  ENTRY_TYPE_DIR_MAP,
  ORGANIZED_DIRS,
  SCHEMA_DEFAULTS,
  stripTypeDir,
  TEMPLATE_PRESETS,
} from "./config/schema";
export type { AppendEventInput, Event } from "./events/event-repository";
export { EventRepository } from "./events/event-repository";
export type { EnrichmentSend } from "./fixtures";
export type {
  FranchiseCollection,
  FranchiseIndex,
  FranchiseIndexMetadata,
} from "./fribb/franchise-index";
export type {
  FribbSource,
  IdentityResolver,
  IdentityResolverEntry,
  IdentityResolverMetadata,
  IdentityResolverResult,
} from "./fribb/identity-resolver";
export { walk } from "./io/directory-walker";
export { hashFile } from "./io/file-hash";
export type { DebugEntry } from "./io/http-client";
export { HttpClient } from "./io/http-client";
export type { ProgressEvent, TaskContext } from "./io/progress";
export type {
  AnimeImporterDeps,
  ImportPreview,
  ImportPreviewEntry,
  ImportResult,
  ImportSelection,
  MatchStatus,
} from "./library/anime-importer";
export { AnimeImporter } from "./library/anime-importer";
export type { AnimeQueryDeps } from "./library/anime-query";
export { AnimeQuery } from "./library/anime-query";
export type {
  AnimeRebuilderDeps,
  ImportMergeEntry,
  MergeEntry,
  ResolveAndMergeInput,
  ResolveAndMergeResult,
  ScanMergeEntry,
  TrackerDataEntry,
} from "./library/anime-rebuilder";
export { AnimeRebuilder } from "./library/anime-rebuilder";
export type { AnimeSourceMapping, LibraryAnime } from "./library/anime-repository";
export { AnimeRepository, resolveAnidbIdByTitle } from "./library/anime-repository";
export { BackgroundRetryService } from "./library/background-retry";
export type { LibraryEpisode } from "./library/episode-repository";
export { EpisodeRepository } from "./library/episode-repository";
export type { Franchise } from "./library/franchise-repository";
export { FranchiseRepository } from "./library/franchise-repository";
export { FranchiseService } from "./library/franchise-service";
export type { EpisodeGroup, GroupTrackerMapping } from "./library/group-repository";
export { GroupRepository } from "./library/group-repository";
export type { LibraryDb } from "./library/schema";
export { createLibraryRepos } from "./library/schema";
export { CacheService } from "./match/cache-service";
export { ManifestRepository } from "./match/manifest-repository";
export { ManifestService } from "./match/manifest-service";
export type { CachedMatch } from "./match/match-repository";
export { MatchRepository } from "./match/match-repository";
export type { MatcherLike, MatchResult } from "./match/matcher";
export {
  bestPerAnimeId,
  isClearWinner,
  Matcher,
  makeAmbiguousResult,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
  resolveEpisode,
} from "./match/matcher";
export type { OverrideData } from "./match/override-store";
export { OVERRIDE_TOML_KEYS, OverrideStore } from "./match/override-store";
export { ArtworkFetcher } from "./media/artwork-fetcher";
export { MetadataWriter } from "./media/metadata-writer";
export { absoluteToRelative, relativeToAbsolute } from "./parse/numbering-converter";
export type { ParsedResult, ParsedTags } from "./parse/parser";
export { createEmptyResult, parse, stripExtension } from "./parse/parser";
export type { RenameAction, RenamePlan, RenameResult } from "./rename/renamer";
export { Renamer } from "./rename/renamer";
export type { SanitizeConfig } from "./rename/sanitize";
export { sanitizeFilename } from "./rename/sanitize";
export { render } from "./rename/template-engine";
export type { CreateScanComponentsOptions, ScanComponents } from "./scan/create-scan-components";
export { createScanComponents } from "./scan/create-scan-components";
export type { PreparedFile } from "./scan/hash-cache";
export { HashCache } from "./scan/hash-cache";
export type { ManualResolution, MatchDecision, MatchInput } from "./scan/match-pipeline";
export {
  applyEntryTypeOverride,
  checkCached,
  checkOverride,
  filterViableMatches,
  getDirectoryTitle,
  MatchPipeline,
  parseFilePath,
  probeMatches,
  resolveManual,
  resolveMatches,
} from "./scan/match-pipeline";
export type { PlanResult, RenameExecutorOptions, RenameOptions } from "./scan/rename-executor";
export { RenameExecutor } from "./scan/rename-executor";
export { aggregateReviewPlan, buildCanonicalIdMap } from "./scan/rename-plan-aggregator";
export type {
  OrchestratorPipeline,
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanEvent,
  ScanExecutionProgressEvent,
  ScanOrchestratorOptions,
  ScanPhaseCompleteEvent,
  ScanProgressEvent,
  ScanReviewReadyEvent,
  ScanState,
} from "./scan/scan-orchestrator";
export { ScanOrchestrator } from "./scan/scan-orchestrator";
export type { ScanResult } from "./scan/scanner";
export { Scanner } from "./scan/scanner";
export type { LocalWatchStatus, OAuthTokenResponse, RefreshFn } from "./tracker/credential-utils";
export {
  ANILIST_CLIENT_ID,
  ANILIST_REDIRECT_URI,
  buildCredentialFromToken,
  generateCodeVerifier,
  loadOrRefreshCredential,
  loadStoredCredential,
  MAL_CLIENT_ID,
  MAL_REDIRECT_URI,
  mapLocalStatusToTracker,
  mapTrackerStatus,
  parseOAuthTokenResponse,
  throwHttpError,
} from "./tracker/credential-utils";
export type {
  CrossTrackerConflict,
  PullResult,
  PushResult,
  SyncAllResult,
  SyncConflict,
} from "./tracker/sync-engine";
export { SyncEngine } from "./tracker/sync-engine";
export type {
  AnimeResult,
  ArtworkResult,
  ArtworkType,
  DatabasePlugin,
  EnrichmentRelation,
  EntryType,
  EpisodeResult,
  FileRow,
  KnownEntry,
  MatchEntry,
  ReviewGroup,
  ReviewPlan,
  ScanFileStatus,
  ScanSummary,
  SubtitlePlugin,
  SubtitleResult,
  SwapPair,
  TrackerAnime,
  TrackerAnimeDetails,
  TrackerCredential,
  TrackerEntry,
  TrackerEntryChanges,
  TrackerErrorType,
  TrackerPlugin,
  TrackerSource,
  TrackerWatchStatus,
} from "./types";
export { isAuthError, TrackerError } from "./types";
