import type { Database } from "bun:sqlite";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    timestamp: text("timestamp").notNull(),
    pushed: text("pushed").notNull().default("[]"),
  },
  (t) => [index("idx_events_pushed").on(t.pushed)],
);

const EVENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TEXT NOT NULL,
    pushed TEXT NOT NULL DEFAULT '[]'
  )
`;

const EVENTS_INDEX_SQL = "CREATE INDEX IF NOT EXISTS idx_events_pushed ON events (pushed)";

export function createEventsTable(sqlite: Database): void {
  sqlite.run(EVENTS_TABLE_SQL);
  sqlite.run(EVENTS_INDEX_SQL);
}
