import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { events } from "./schema";

export function createEventsDb(dir?: string) {
  const path = dir ? `${dir}/events.db` : ":memory:";
  const sqlite = new Database(path);
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL,
      pushed INTEGER NOT NULL DEFAULT 0
    )
  `);
  const db = drizzle(sqlite, { schema: { events } });
  return { db, sqlite };
}
