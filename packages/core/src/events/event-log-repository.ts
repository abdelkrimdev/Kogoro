import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { events } from "./schema";

export interface EventRecord {
  id: number;
  entityType: "group" | "episode";
  entityId: number;
  eventType: "status_change" | "watched_toggle" | "notes_update";
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  pushed: boolean;
}

type EventsSchema = { events: typeof events };
type EventsDb = BaseSQLiteDatabase<"sync", void, EventsSchema>;

export class EventLogRepository {
  constructor(private db: EventsDb) {}

  append(event: Omit<EventRecord, "id">): EventRecord {
    const result = this.db
      .insert(events)
      .values({
        entityType: event.entityType,
        entityId: event.entityId,
        eventType: event.eventType,
        oldValue: event.oldValue,
        newValue: event.newValue,
        timestamp: event.timestamp,
        pushed: event.pushed,
      })
      .returning()
      .get();

    return this.rowToEvent(result);
  }

  getUnpushedEvents(): EventRecord[] {
    const rows = this.db
      .select()
      .from(events)
      .where(eq(events.pushed, false))
      .orderBy(events.timestamp)
      .all();
    return rows.map(this.rowToEvent);
  }

  markAsPushed(eventIds: number[]): void {
    for (const id of eventIds) {
      this.db.update(events).set({ pushed: true }).where(eq(events.id, id)).run();
    }
  }

  replay(): Array<{
    entityType: string;
    entityId: number;
    eventType: string;
    oldValue: string | null;
    newValue: string | null;
    timestamp: string;
  }> {
    return this.db
      .select({
        entityType: events.entityType,
        entityId: events.entityId,
        eventType: events.eventType,
        oldValue: events.oldValue,
        newValue: events.newValue,
        timestamp: events.timestamp,
      })
      .from(events)
      .orderBy(events.timestamp)
      .all();
  }

  clear(): void {
    this.db.delete(events).run();
  }

  private rowToEvent(row: {
    id: number;
    entityType: string;
    entityId: number;
    eventType: string;
    oldValue: string | null;
    newValue: string | null;
    timestamp: string;
    pushed: boolean;
  }): EventRecord {
    return {
      id: row.id,
      entityType: row.entityType as EventRecord["entityType"],
      entityId: row.entityId,
      eventType: row.eventType as EventRecord["eventType"],
      oldValue: row.oldValue,
      newValue: row.newValue,
      timestamp: row.timestamp,
      pushed: row.pushed,
    };
  }
}
