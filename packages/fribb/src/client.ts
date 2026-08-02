import { Database } from "bun:sqlite";
import type {
  FranchiseCollection,
  FranchiseIndex,
  FranchiseIndexMetadata,
  FribbSource,
  IdentityResolver,
  IdentityResolverEntry,
  IdentityResolverMetadata,
  IdentityResolverResult,
} from "@kogoro/core";

const SOURCE_INDEX_TABLE_MAP: Record<string, string> = {
  anidb: "idx_anidb",
  anilist: "idx_anilist",
  mal: "idx_mal",
  kitsu: "idx_kitsu",
  tvdb: "idx_tvdb",
  animecountdown: "idx_animecountdown",
  animenewsnetwork: "idx_animenewsnetwork",
  anisearch: "idx_anisearch",
  livechart: "idx_livechart",
  simkl: "idx_simkl",
  tmdb: "idx_tmdb_tv",
};

const SUPPORTED_SOURCES: FribbSource[] = [
  "anidb",
  "anilist",
  "mal",
  "kitsu",
  "tvdb",
  "imdb",
  "tmdb",
];

class FribbClient implements IdentityResolver, FranchiseIndex {
  private sqlite: Database;

  constructor(dbPath: string) {
    this.sqlite = new Database(dbPath, { readonly: true });
  }

  private parseFranchiseTitle(collectionName: string): {
    sourcePrefix: string;
    franchiseTitle: string;
  } {
    const colonIndex = collectionName.indexOf(":");
    if (colonIndex >= 0) {
      return {
        sourcePrefix: collectionName.slice(0, colonIndex),
        franchiseTitle: collectionName.slice(colonIndex + 1),
      };
    }
    return { sourcePrefix: "", franchiseTitle: collectionName };
  }

  async resolveToAnidb(source: FribbSource, sourceId: string): Promise<string | null> {
    if (source === "imdb") {
      return this.resolveImdbToAnidb(sourceId);
    }
    const tableName = SOURCE_INDEX_TABLE_MAP[source];
    if (!tableName) return null;

    const row = this.sqlite
      .query(`SELECT anidb_id FROM ${tableName} WHERE source_id = ?`)
      .get(sourceId) as { anidb_id: number } | undefined;
    return row ? String(row.anidb_id) : null;
  }

  private resolveImdbToAnidb(imdbId: string): string | null {
    const row = this.sqlite
      .query(`SELECT anidb_id FROM entries, json_each(entries.imdb_ids) WHERE json_each.value = ?`)
      .get(imdbId) as { anidb_id: number } | undefined;
    return row ? String(row.anidb_id) : null;
  }

  async resolveBatchToAnidb(
    entriesToResolve: IdentityResolverEntry[],
  ): Promise<IdentityResolverResult[]> {
    const results: IdentityResolverResult[] = [];
    const bySource = new Map<string, IdentityResolverEntry[]>();

    for (const entry of entriesToResolve) {
      const group = bySource.get(entry.source) ?? [];
      group.push(entry);
      bySource.set(entry.source, group);
    }

    for (const [source, entries] of bySource) {
      if (source === "imdb") {
        for (const entry of entries) {
          const anidbId = this.resolveImdbToAnidb(entry.sourceId);
          results.push({ source: entry.source, sourceId: entry.sourceId, anidbId });
        }
        continue;
      }

      const tableName = SOURCE_INDEX_TABLE_MAP[source];
      if (!tableName) {
        for (const entry of entries) {
          results.push({ source: entry.source, sourceId: entry.sourceId, anidbId: null });
        }
        continue;
      }

      const sourceIds = entries.map((e) => e.sourceId);
      const placeholders = sourceIds.map(() => "?").join(", ");
      const rows = this.sqlite
        .query(`SELECT source_id, anidb_id FROM ${tableName} WHERE source_id IN (${placeholders})`)
        .all(...sourceIds) as Array<{ source_id: string; anidb_id: number }>;

      const resolvedMap = new Map(rows.map((r) => [String(r.source_id), String(r.anidb_id)]));

      for (const entry of entries) {
        results.push({
          source: entry.source,
          sourceId: entry.sourceId,
          anidbId: resolvedMap.get(entry.sourceId) ?? null,
        });
      }
    }

    return results;
  }

  async getMetadata(): Promise<IdentityResolverMetadata & FranchiseIndexMetadata> {
    const versionRow = this.sqlite
      .query("SELECT value FROM meta WHERE key = 'dataset_version'")
      .get() as { value: string } | undefined;
    const dateRow = this.sqlite.query("SELECT value FROM meta WHERE key = 'dataset_date'").get() as
      | { value: string }
      | undefined;
    const collectionCountRow = this.sqlite
      .query("SELECT COUNT(*) as count FROM collections")
      .get() as { count: number };
    return {
      datasetVersion: versionRow?.value ?? "",
      datasetDate: dateRow?.value ?? "",
      supportedSources: SUPPORTED_SOURCES,
      collectionCount: collectionCountRow.count,
    };
  }

  async getCollectionForAnidb(anidbId: string): Promise<FranchiseCollection | null> {
    const collectionRow = this.sqlite
      .query("SELECT collection_name FROM collections WHERE anidb_id = ?")
      .get(Number(anidbId)) as { collection_name: string } | undefined;
    if (!collectionRow) return null;

    const collectionName = collectionRow.collection_name;
    const rows = this.sqlite
      .query("SELECT anidb_id FROM collections WHERE collection_name = ?")
      .all(collectionName) as Array<{ anidb_id: number }>;
    const members = rows.map((r) => String(r.anidb_id));
    const { franchiseTitle } = this.parseFranchiseTitle(collectionName);
    return {
      anidbId,
      franchiseTitle,
      members,
    };
  }

  async getAllCollections(): Promise<FranchiseCollection[]> {
    const rows = this.sqlite
      .query("SELECT collection_name, anidb_id FROM collections ORDER BY collection_name")
      .all() as Array<{ collection_name: string; anidb_id: number }>;

    const collectionMap = new Map<string, string[]>();
    for (const row of rows) {
      const existing = collectionMap.get(row.collection_name) ?? [];
      existing.push(String(row.anidb_id));
      collectionMap.set(row.collection_name, existing);
    }

    const collections: FranchiseCollection[] = [];
    for (const [collectionName, members] of collectionMap) {
      const { franchiseTitle } = this.parseFranchiseTitle(collectionName);
      // Use first member as anidbId (any member would work)
      collections.push({
        anidbId: members[0] ?? "",
        franchiseTitle,
        members,
      });
    }
    return collections;
  }
}

export function createFribbConnection(dbPath: string): IdentityResolver & FranchiseIndex {
  return new FribbClient(dbPath);
}
