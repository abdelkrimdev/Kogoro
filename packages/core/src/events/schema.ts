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
