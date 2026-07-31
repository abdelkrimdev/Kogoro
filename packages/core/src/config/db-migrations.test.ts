import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { isAlreadyAppliedError, makeIdempotent, safeMigrate } from "./db-migrations";

describe("makeIdempotent", () => {
  test("wraps CREATE TABLE with IF NOT EXISTS", () => {
    const input = "CREATE TABLE `users` (`id` integer PRIMARY KEY)";
    const result = makeIdempotent(input);
    expect(result).toBe("CREATE TABLE IF NOT EXISTS `users` (`id` integer PRIMARY KEY)");
  });

  test("wraps CREATE UNIQUE INDEX with IF NOT EXISTS", () => {
    const input = "CREATE UNIQUE INDEX `idx_name` ON `users` (`name`)";
    const result = makeIdempotent(input);
    expect(result).toBe("CREATE UNIQUE INDEX IF NOT EXISTS `idx_name` ON `users` (`name`)");
  });

  test("wraps CREATE INDEX with IF NOT EXISTS", () => {
    const input = "CREATE INDEX `idx_email` ON `users` (`email`)";
    const result = makeIdempotent(input);
    expect(result).toBe("CREATE INDEX IF NOT EXISTS `idx_email` ON `users` (`email`)");
  });

  test("handles multiple statements in one string", () => {
    const input = [
      "CREATE TABLE `anime` (`id` integer PRIMARY KEY);",
      "CREATE UNIQUE INDEX `idx_ext` ON `anime` (`external_id`);",
      "CREATE INDEX `idx_title` ON `anime` (`title`);",
    ].join("\n");
    const result = makeIdempotent(input);
    expect(result).toContain("CREATE TABLE IF NOT EXISTS `anime`");
    expect(result).toContain("CREATE UNIQUE INDEX IF NOT EXISTS `idx_ext`");
    expect(result).toContain("CREATE INDEX IF NOT EXISTS `idx_title`");
  });

  test("leaves non-DDL SQL unchanged", () => {
    const input = "ALTER TABLE `anime` ADD `notes` text;";
    expect(makeIdempotent(input)).toBe(input);
  });
});

describe("isAlreadyAppliedError", () => {
  test("returns true for duplicate column name error", () => {
    const err = new Error("duplicate column name: notes");
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns true for already exists error", () => {
    const err = new Error("table users already exists");
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns true when cause contains duplicate column name", () => {
    const cause = new Error("duplicate column name: title");
    const err = new Error("migration failed");
    err.cause = cause;
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns true when cause contains already exists", () => {
    const cause = new Error("index idx_name already exists");
    const err = new Error("migration failed");
    err.cause = cause;
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns false for unrelated error", () => {
    const err = new Error("database is locked");
    expect(isAlreadyAppliedError(err)).toBe(false);
  });

  test("returns false for non-Error values", () => {
    expect(isAlreadyAppliedError("string error")).toBe(false);
    expect(isAlreadyAppliedError(null)).toBe(false);
    expect(isAlreadyAppliedError(undefined)).toBe(false);
    expect(isAlreadyAppliedError(42)).toBe(false);
  });
});

describe("schema verification", () => {
  function getColumnNames(sqlite: Database, table: string): string[] {
    const rows = sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  function getUniqueIndexes(sqlite: Database, table: string): string[][] {
    const rows = sqlite.query(`PRAGMA index_list(${table})`).all() as Array<{
      name: string;
      unique: number;
    }>;
    const uniqueIndexes: string[][] = [];
    for (const idx of rows.filter((r) => r.unique === 1)) {
      const info = sqlite.query(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string }>;
      uniqueIndexes.push(info.map((i) => i.name));
    }
    return uniqueIndexes;
  }

  function createFreshDatabase(): Database {
    const sqlite = new Database(":memory:");
    sqlite.run("PRAGMA foreign_keys = ON");
    const db = drizzle(sqlite);
    safeMigrate(db);
    return sqlite;
  }

  function withFreshDatabase(fn: (sqlite: Database) => void): void {
    const sqlite = createFreshDatabase();
    try {
      fn(sqlite);
    } finally {
      sqlite.close();
    }
  }

  test("anime has expected columns and no dropped columns", () => {
    withFreshDatabase((sqlite) => {
      const columns = getColumnNames(sqlite, "anime");
      expect(columns).toContain("id");
      expect(columns).toContain("title");
      expect(columns).toContain("alternative_titles");
      expect(columns).toContain("anidb_id");
      expect(columns).toContain("cover_art_path");
      expect(columns).toContain("format");
      expect(columns).toContain("franchise_id");
      expect(columns).toContain("updated_at");

      expect(columns).not.toContain("episode_count");
      expect(columns).not.toContain("library_state");
      expect(columns).not.toContain("genres");
      expect(columns).not.toContain("last_synced");
      expect(columns).not.toContain("anilist_id");
    });
  });

  test("episode_groups has updated_at and no last_synced", () => {
    withFreshDatabase((sqlite) => {
      const columns = getColumnNames(sqlite, "episode_groups");
      expect(columns).toContain("updated_at");
      expect(columns).not.toContain("last_synced");
    });
  });

  test("episodes has no anime_id or season, unique index on (group_id, episode_number)", () => {
    withFreshDatabase((sqlite) => {
      const columns = getColumnNames(sqlite, "episodes");
      expect(columns).not.toContain("anime_id");
      expect(columns).not.toContain("season");

      const uniqueIndexes = getUniqueIndexes(sqlite, "episodes");
      expect(uniqueIndexes).toContainEqual(["group_id", "episode_number"]);
    });
  });

  test("anime_source_mappings has unique index on (anime_id, source) and no id column", () => {
    withFreshDatabase((sqlite) => {
      const columns = getColumnNames(sqlite, "anime_source_mappings");
      expect(columns).not.toContain("id");

      const uniqueIndexes = getUniqueIndexes(sqlite, "anime_source_mappings");
      expect(uniqueIndexes).toContainEqual(["anime_id", "source"]);
    });
  });

  test("franchises has updated_at and no anilist_id", () => {
    withFreshDatabase((sqlite) => {
      const columns = getColumnNames(sqlite, "franchises");
      expect(columns).toContain("updated_at");
      expect(columns).not.toContain("anilist_id");
    });
  });

  test("anilist_cache table does not exist", () => {
    withFreshDatabase((sqlite) => {
      const tables = sqlite
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='anilist_cache'")
        .all();
      expect(tables).toHaveLength(0);
    });
  });
});
