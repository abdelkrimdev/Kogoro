export type EntryType = "tv" | "movie" | "ova" | "special";

export interface MatchEntry {
  animeId: string;
  animeTitle: string;
  entryType: EntryType;
  episodeId: string | null;
  episode: number | null;
  season: number | null;
  title: string | null;
  filePath: string;
  sourceDb: string;
  anilistId?: string;
}

export type ArtworkType = "poster" | "banner" | "fanart" | "thumbnail";

export interface AnimeResult {
  id: string;
  slug?: string;
  titleEn: string;
  titleJa?: string;
  alternativeTitles?: string[];
  overview?: string;
  year?: number;
  image?: string;
  status?: string;
  entryType: EntryType;
}

export interface EpisodeResult {
  id: string;
  animeId: string;
  season: number;
  episode: number;
  titleEn: string;
  titleJa?: string;
  airDate?: string;
  overview?: string;
  image?: string;
  entryType: EntryType;
}

export interface ArtworkResult {
  id: string;
  type: ArtworkType;
  url: string;
  width?: number;
  height?: number;
  language?: string;
  season?: number;
}

export interface SubtitleResult {
  id: string;
  fileId: number;
  language: string;
  format: string;
  score: number;
  fileName: string;
}

export interface DatabasePlugin {
  searchAnime(title: string): Promise<AnimeResult[]>;
  getAnime(animeId: string): Promise<AnimeResult | null>;
  getEpisodes(animeId: string): Promise<EpisodeResult[]>;
  getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]>;
}

export interface SubtitlePlugin {
  search(
    animeTitle: string,
    season?: number,
    episode?: number,
    language?: string,
  ): Promise<SubtitleResult[]>;
  download(fileId: number): Promise<string>;
}

export type ScanFileStatus =
  | "matched"
  | "cached"
  | "skipped"
  | "ambiguous"
  | "failed"
  | "pending"
  | "renamed"
  | "rename-failed";

export interface TopCandidate {
  episodeNumber: number;
  title: string;
}

export interface FileRow {
  fileId: string;
  sourcePath: string;
  proposedPath: string | null;
  status: ScanFileStatus;
  animeId: string | null;
  episodeId: string | null;
  season: number | null;
  episode: number | null;
  episodeName: string | null;
  failureReason?: string;
  topCandidates?: TopCandidate[];
}

export interface ReviewGroup {
  animeId: string;
  animeTitle: string;
  entryType: string;
  image?: string;
  files: FileRow[];
  swapPairs: SwapPair[];
  rejected?: boolean;
  mergeMode?: boolean;
}

export interface SwapPair {
  fileAId: string;
  fileBId: string;
}

export interface ReviewPlan {
  sessionId: string;
  groups: ReviewGroup[];
  totalFiles: number;
  ambiguousCount: number;
  initialAmbiguousCount?: number;
}

export interface ScanSummary {
  sessionId: string;
  totalFiles: number;
  matched: number;
  cached: number;
  ambiguous: number;
  failed: number;
  renamed: number;
  renameFailed: number;
  renameFailures: Array<{ file: string; reason: string }>;
}

export type TrackerWatchStatus = "watching" | "completed" | "plan-to-watch" | "on-hold" | "dropped";

export type TrackerErrorType =
  | "auth_expired"
  | "auth_invalid"
  | "rate_limited"
  | "not_found"
  | "network"
  | "unknown";

export class TrackerError extends Error {
  readonly type: TrackerErrorType;
  readonly tracker?: string;

  constructor(type: TrackerErrorType, message: string, tracker?: string) {
    super(message);
    this.name = "TrackerError";
    this.type = type;
    this.tracker = tracker;
  }
}

export function isAuthError(error: unknown): error is TrackerError {
  return (
    error instanceof TrackerError &&
    (error.type === "auth_expired" || error.type === "auth_invalid")
  );
}

export interface TrackerCredential {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export type TrackerSource = "mal" | "anilist" | "kitsu";

export interface TrackerAnime {
  source: TrackerSource;
  trackerId: string;
  title: string;
  alternativeTitles?: string[];
  image?: string;
  year?: number;
  entryType: EntryType;
  watchStatus: TrackerWatchStatus;
  episodesWatched: number;
  totalEpisodes: number;
  score?: number;
}

export interface TrackerEntry {
  trackerId: string;
  title: string;
  watchStatus: TrackerWatchStatus;
  episodesWatched: number;
  totalEpisodes: number;
  score?: number;
  notes?: string;
}

export interface TrackerEntryChanges {
  watchStatus?: TrackerWatchStatus;
  episodesWatched?: number;
  score?: number;
  notes?: string;
}

export interface TrackerAnimeDetails {
  trackerId: string;
  title: string;
  alternativeTitles?: string[];
  image?: string;
  year?: number;
  entryType: EntryType;
  synopsis?: string;
  rating?: number;
  genres?: string[];
  studio?: string;
  totalEpisodes?: number;
}

export interface EnrichmentSearchResult {
  anilistId: string;
  title: string;
  format?: string;
  episodes?: number;
}

export interface EnrichmentRelation {
  anilistId: string;
  title: string;
  relationType: string;
  format?: string;
}

export interface EnrichmentMediaResult {
  anilistId: string;
  title: string;
  format?: string;
  episodes?: number;
  relations: EnrichmentRelation[];
  externalLinks?: { site: string; id: string }[];
}

export interface EnrichmentProvider {
  searchByTitle(title: string): Promise<EnrichmentSearchResult | null>;
  getMediaDetailsBatch(anilistIds: string[]): Promise<EnrichmentMediaResult[]>;
}

export type KnownEntry = { anilistId: string; title: string };

export interface TrackerPlugin {
  authenticate(): Promise<string>;
  ensureAuthenticated(): Promise<void>;
  getUserList(): Promise<TrackerAnime[]>;
  getEntry(trackerId: string): Promise<TrackerEntry>;
  updateEntry(trackerId: string, changes: TrackerEntryChanges): Promise<void>;
  getAnimeDetails(trackerId: string): Promise<TrackerAnimeDetails>;
  refreshSession?(): Promise<TrackerCredential>;
  generateAuthUrl?(): Promise<string>;
  exchangeCode?(code: string): Promise<TrackerCredential>;
}
