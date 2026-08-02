export type FribbSource = "anidb" | "anilist" | "mal" | "kitsu" | "tvdb" | "imdb" | "tmdb";

export interface IdentityResolverEntry {
  source: FribbSource;
  sourceId: string;
}

export interface IdentityResolverResult {
  source: FribbSource;
  sourceId: string;
  anidbId: string | null;
}

export interface IdentityResolverMetadata {
  datasetVersion: string;
  datasetDate: string;
  supportedSources: FribbSource[];
}

export interface IdentityResolver {
  resolveToAnidb(source: FribbSource, sourceId: string): Promise<string | null>;

  resolveBatchToAnidb(entries: IdentityResolverEntry[]): Promise<IdentityResolverResult[]>;

  getMetadata(): Promise<IdentityResolverMetadata>;
}
