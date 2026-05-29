import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_DIR } from "./config/schema";
import type { EntryType } from "./types";

export interface LibraryAnime {
  id: number;
  externalId: string;
  sourceDb: string;
  title: string;
  titleJapanese?: string;
  entryType: EntryType;
  episodeCount: number;
  coverArtPath?: string;
  lastSynced: string;
}

export interface LibraryEpisode {
  id: number;
  animeId: number;
  episodeNumber: number;
  filePath: string;
  title?: string;
  season?: number;
}

export interface WatchStatus {
  episodeId: number;
  watched: boolean;
  notes?: string;
  updatedAt: string;
}

interface LibraryDbOptions {
  dbPath?: string;
}

export class LibraryDb {
  private db: Database;

  constructor(options: LibraryDbOptions = {}) {
    const dbPath = options.dbPath ?? join(CONFIG_DIR, "library.db");
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.createSchema();
  }

  private createSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS anime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT NOT NULL,
        source_db TEXT NOT NULL,
        title TEXT NOT NULL,
        title_japanese TEXT,
        entry_type TEXT NOT NULL DEFAULT 'tv',
        episode_count INTEGER NOT NULL DEFAULT 0,
        cover_art_path TEXT,
        last_synced TEXT NOT NULL,
        UNIQUE(external_id, source_db)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_id INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        title TEXT,
        season INTEGER DEFAULT 1,
        FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
        UNIQUE(anime_id, episode_number, season)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS watch_status (
        episode_id INTEGER PRIMARY KEY,
        watched INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);
  }

  upsertAnime(anime: Omit<LibraryAnime, "id" | "lastSynced">): LibraryAnime {
    const existing = this.db
      .prepare("SELECT id FROM anime WHERE external_id = $externalId AND source_db = $sourceDb")
      .get({
        $externalId: anime.externalId,
        $sourceDb: anime.sourceDb,
      }) as { id: number } | null;

    if (existing) {
      this.db
        .prepare(
          `UPDATE anime SET title = $title, title_japanese = $titleJapanese, entry_type = $entryType,
          episode_count = $episodeCount, cover_art_path = $coverArtPath, last_synced = $lastSynced
          WHERE id = $id`,
        )
        .run({
          $id: existing.id,
          $title: anime.title,
          $titleJapanese: anime.titleJapanese ?? null,
          $entryType: anime.entryType,
          $episodeCount: anime.episodeCount,
          $coverArtPath: anime.coverArtPath ?? null,
          $lastSynced: new Date().toISOString(),
        });
      return this.getAnime(existing.id) as LibraryAnime;
    }

    const result = this.db
      .prepare(
        `INSERT INTO anime (external_id, source_db, title, title_japanese, entry_type, episode_count, cover_art_path, last_synced)
        VALUES ($externalId, $sourceDb, $title, $titleJapanese, $entryType, $episodeCount, $coverArtPath, $lastSynced)`,
      )
      .run({
        $externalId: anime.externalId,
        $sourceDb: anime.sourceDb,
        $title: anime.title,
        $titleJapanese: anime.titleJapanese ?? null,
        $entryType: anime.entryType,
        $episodeCount: anime.episodeCount,
        $coverArtPath: anime.coverArtPath ?? null,
        $lastSynced: new Date().toISOString(),
      });

    return this.getAnime(Number(result.lastInsertRowid)) as LibraryAnime;
  }

  getAnime(id: number): LibraryAnime | null {
    const row = this.db
      .prepare("SELECT * FROM anime WHERE id = $id")
      .get({ $id: id }) as LibraryAnimeRow | null;
    return row ? this.rowToAnime(row) : null;
  }

  findAnime(externalId: string, sourceDb: string): LibraryAnime | null {
    const row = this.db
      .prepare("SELECT * FROM anime WHERE external_id = $externalId AND source_db = $sourceDb")
      .get({ $externalId: externalId, $sourceDb: sourceDb }) as LibraryAnimeRow | null;
    return row ? this.rowToAnime(row) : null;
  }

  listAnime(): LibraryAnime[] {
    const rows = this.db.prepare("SELECT * FROM anime ORDER BY title").all() as LibraryAnimeRow[];
    return rows.map(this.rowToAnime);
  }

  deleteAnime(id: number): void {
    this.db.prepare("DELETE FROM anime WHERE id = $id").run({ $id: id });
  }

  addEpisode(episode: Omit<LibraryEpisode, "id">): LibraryEpisode {
    const existing = this.db
      .prepare(
        "SELECT id FROM episodes WHERE anime_id = $animeId AND episode_number = $episodeNumber AND COALESCE(season, 1) = COALESCE($season, 1)",
      )
      .get({
        $animeId: episode.animeId,
        $episodeNumber: episode.episodeNumber,
        $season: episode.season ?? 1,
      }) as { id: number } | null;

    if (existing) {
      this.db
        .prepare(`UPDATE episodes SET file_path = $filePath, title = $title WHERE id = $id`)
        .run({
          $id: existing.id,
          $filePath: episode.filePath,
          $title: episode.title ?? null,
        });
      return this.getEpisode(existing.id) as LibraryEpisode;
    }

    const result = this.db
      .prepare(
        `INSERT INTO episodes (anime_id, episode_number, file_path, title, season)
        VALUES ($animeId, $episodeNumber, $filePath, $title, $season)`,
      )
      .run({
        $animeId: episode.animeId,
        $episodeNumber: episode.episodeNumber,
        $filePath: episode.filePath,
        $title: episode.title ?? null,
        $season: episode.season ?? 1,
      });

    return this.getEpisode(Number(result.lastInsertRowid)) as LibraryEpisode;
  }

  getEpisode(id: number): LibraryEpisode | null {
    const row = this.db
      .prepare("SELECT * FROM episodes WHERE id = $id")
      .get({ $id: id }) as LibraryEpisodeRow | null;
    return row ? this.rowToEpisode(row) : null;
  }

  getEpisodesByAnimeId(animeId: number): LibraryEpisode[] {
    const rows = this.db
      .prepare("SELECT * FROM episodes WHERE anime_id = $animeId ORDER BY season, episode_number")
      .all({ $animeId: animeId }) as LibraryEpisodeRow[];
    return rows.map(this.rowToEpisode);
  }

  deleteEpisodesByAnimeId(animeId: number): void {
    this.db.prepare("DELETE FROM episodes WHERE anime_id = $animeId").run({ $animeId: animeId });
  }

  setWatchStatus(episodeId: number, watched: boolean, notes?: string): WatchStatus {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO watch_status (episode_id, watched, notes, updated_at)
        VALUES ($episodeId, $watched, $notes, $updatedAt)`,
      )
      .run({
        $episodeId: episodeId,
        $watched: watched ? 1 : 0,
        $notes: notes ?? null,
        $updatedAt: now,
      });

    return { episodeId, watched, notes, updatedAt: now };
  }

  getWatchStatus(episodeId: number): WatchStatus | null {
    const row = this.db
      .prepare("SELECT * FROM watch_status WHERE episode_id = $episodeId")
      .get({ $episodeId: episodeId }) as WatchStatusRow | null;
    return row ? this.rowToWatchStatus(row) : null;
  }

  getWatchStatusByAnimeId(animeId: number): WatchStatus[] {
    const rows = this.db
      .prepare(
        `SELECT ws.* FROM watch_status ws
        JOIN episodes e ON ws.episode_id = e.id
        WHERE e.anime_id = $animeId`,
      )
      .all({ $animeId: animeId }) as WatchStatusRow[];
    return rows.map(this.rowToWatchStatus);
  }

  mergeAnime(
    anime: Omit<LibraryAnime, "id" | "lastSynced">,
    episodes: Omit<LibraryEpisode, "id" | "animeId">[],
  ): { anime: LibraryAnime; episodes: LibraryEpisode[]; merged: boolean } {
    const existing = this.findAnime(anime.externalId, anime.sourceDb);
    let merged = false;
    let libraryAnime: LibraryAnime;

    if (existing) {
      libraryAnime = this.upsertAnime({
        ...anime,
        episodeCount: existing.episodeCount + anime.episodeCount,
      });
      merged = true;
    } else {
      libraryAnime = this.upsertAnime(anime);
    }

    const libraryEpisodes: LibraryEpisode[] = [];
    for (const ep of episodes) {
      const libraryEp = this.addEpisode({
        ...ep,
        animeId: libraryAnime.id,
      });
      libraryEpisodes.push(libraryEp);
    }

    return { anime: libraryAnime, episodes: libraryEpisodes, merged };
  }

  rebuildFromMatches(
    matches: Array<{
      animeId: string;
      animeTitle: string;
      entryType: EntryType;
      episodeId: string | null;
      episode: number | null;
      season: number | null;
      title: string | null;
      filePath: string;
    }>,
    sourceDb: string,
  ): void {
    this.db.run("DELETE FROM watch_status");
    this.db.run("DELETE FROM episodes");
    this.db.run("DELETE FROM anime");

    for (const match of matches) {
      const anime = this.upsertAnime({
        externalId: match.animeId,
        sourceDb,
        title: match.animeTitle,
        entryType: match.entryType,
        episodeCount: 0,
      });

      if (match.episode !== null && match.filePath) {
        this.addEpisode({
          animeId: anime.id,
          episodeNumber: match.episode,
          filePath: match.filePath,
          title: match.title ?? undefined,
          season: match.season ?? undefined,
        });
      }
    }
  }

  close(): void {
    this.db.close();
  }

  private rowToAnime(row: LibraryAnimeRow): LibraryAnime {
    return {
      id: row.id,
      externalId: row.external_id,
      sourceDb: row.source_db,
      title: row.title,
      titleJapanese: row.title_japanese ?? undefined,
      entryType: row.entry_type as EntryType,
      episodeCount: row.episode_count,
      coverArtPath: row.cover_art_path ?? undefined,
      lastSynced: row.last_synced,
    };
  }

  private rowToEpisode(row: LibraryEpisodeRow): LibraryEpisode {
    return {
      id: row.id,
      animeId: row.anime_id,
      episodeNumber: row.episode_number,
      filePath: row.file_path,
      title: row.title ?? undefined,
      season: row.season ?? undefined,
    };
  }

  private rowToWatchStatus(row: WatchStatusRow): WatchStatus {
    return {
      episodeId: row.episode_id,
      watched: row.watched === 1,
      notes: row.notes ?? undefined,
      updatedAt: row.updated_at,
    };
  }
}

interface LibraryAnimeRow {
  id: number;
  external_id: string;
  source_db: string;
  title: string;
  title_japanese: string | null;
  entry_type: string;
  episode_count: number;
  cover_art_path: string | null;
  last_synced: string;
}

interface LibraryEpisodeRow {
  id: number;
  anime_id: number;
  episode_number: number;
  file_path: string;
  title: string | null;
  season: number | null;
}

interface WatchStatusRow {
  episode_id: number;
  watched: number;
  notes: string | null;
  updated_at: string;
}
