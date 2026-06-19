import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { createEventsTable, events } from "./schema";

export type EventDb = ReturnType<typeof createEventDb>;

export function createEventDb(dir?: string) {
  const path = dir ? `${dir}/events.db` : ":memory:";
  const sqlite = new Database(path);
  sqlite.run("PRAGMA foreign_keys = ON");
  createEventsTable(sqlite);
  const db = drizzle(sqlite, { schema: { events } });
  return { db, sqlite };
}
