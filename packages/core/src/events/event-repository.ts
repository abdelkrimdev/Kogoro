import { and, eq, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { events } from "./schema";

export interface Event {
  id: number;
  entityType: string;
  entityId: number;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  pushed: string[];
}

export interface AppendEventInput {
  entityType: "group" | "episode";
  entityId: number;
  eventType: "status_change" | "watched_toggle" | "notes_update";
  oldValue: string | null;
  newValue: string;
}

type EventsSchema = { events: typeof events };
type EventsDb = BunSQLiteDatabase<EventsSchema>;

export class EventRepository {
  constructor(private db: EventsDb) {}

  append(input: AppendEventInput): Event {
    const now = new Date().toISOString();
    const result = this.db
      .insert(events)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        oldValue: input.oldValue,
        newValue: input.newValue,
        timestamp: now,
        pushed: "[]",
      })
      .returning()
      .get();

    return this.rowToEvent(result);
  }

  replay(): Event[] {
    const rows = this.db.select().from(events).orderBy(events.timestamp).all();
    return rows.map(this.rowToEvent);
  }

  getAllForEntity(entityType: string, entityId: number): Event[] {
    const rows = this.db
      .select()
      .from(events)
      .where(and(eq(events.entityType, entityType), eq(events.entityId, entityId)))
      .orderBy(events.timestamp)
      .all();
    return rows.map(this.rowToEvent);
  }

  getUnpushed(source?: string): Event[] {
    const condition = source
      ? sql`json_extract(${events.pushed}, '$') NOT LIKE ${`%"${source}"%`}`
      : eq(events.pushed, "[]");
    const rows = this.db.select().from(events).where(condition).orderBy(events.timestamp).all();
    return rows.map(this.rowToEvent);
  }

  markPushed(eventIds: number[], sources: string[]): void {
    const pushedValue = JSON.stringify(sources);
    for (const id of eventIds) {
      this.db.update(events).set({ pushed: pushedValue }).where(eq(events.id, id)).run();
    }
  }

  markPushedForSource(eventIds: number[], source: string): void {
    for (const id of eventIds) {
      const row = this.db.select().from(events).where(eq(events.id, id)).get();
      if (!row) continue;
      const pushed: string[] = JSON.parse(row.pushed);
      if (!pushed.includes(source)) {
        pushed.push(source);
      }
      this.db
        .update(events)
        .set({ pushed: JSON.stringify(pushed) })
        .where(eq(events.id, id))
        .run();
    }
  }

  dropForSource(source: string): void {
    const rows = this.db
      .select()
      .from(events)
      .where(sql`json_extract(${events.pushed}, '$') LIKE ${`%"${source}"%`}`)
      .all();
    for (const row of rows) {
      const pushed: string[] = JSON.parse(row.pushed);
      const updated = pushed.filter((s) => s !== source);
      this.db
        .update(events)
        .set({ pushed: JSON.stringify(updated) })
        .where(eq(events.id, row.id))
        .run();
    }
  }

  private rowToEvent(row: typeof events.$inferSelect): Event {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      eventType: row.eventType,
      oldValue: row.oldValue,
      newValue: row.newValue,
      timestamp: row.timestamp,
      pushed: JSON.parse(row.pushed) as string[],
    };
  }
}
