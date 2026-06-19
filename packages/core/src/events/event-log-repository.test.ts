import { describe, expect, it } from "bun:test";
import { EventLogRepository } from "./event-log-repository";
import { createEventsDb } from "./test-utils";

describe("EventLogRepository", () => {
  describe("append", () => {
    it("creates an event record", () => {
      const { db, sqlite } = createEventsDb();
      try {
        const repo = new EventLogRepository(db);
        const event = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
          timestamp: "2026-01-01T00:00:00.000Z",
          pushed: false,
        });

        expect(event.id).toBe(1);
        expect(event.entityType).toBe("group");
        expect(event.entityId).toBe(1);
        expect(event.eventType).toBe("status_change");
        expect(event.oldValue).toBe("watching");
        expect(event.newValue).toBe("completed");
        expect(event.pushed).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getUnpushedEvents", () => {
    it("returns only unpushed events", () => {
      const { db, sqlite } = createEventsDb();
      try {
        const repo = new EventLogRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
          timestamp: "2026-01-01T00:00:00.000Z",
          pushed: false,
        });
        repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
          timestamp: "2026-01-02T00:00:00.000Z",
          pushed: true,
        });

        const unpushed = repo.getUnpushedEvents();
        expect(unpushed).toHaveLength(1);
        expect(unpushed[0]?.id).toBe(1);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("markAsPushed", () => {
    it("marks events as pushed", () => {
      const { db, sqlite } = createEventsDb();
      try {
        const repo = new EventLogRepository(db);
        const event1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
          timestamp: "2026-01-01T00:00:00.000Z",
          pushed: false,
        });
        const event2 = repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
          timestamp: "2026-01-02T00:00:00.000Z",
          pushed: false,
        });

        repo.markAsPushed([event1.id]);

        const unpushed = repo.getUnpushedEvents();
        expect(unpushed).toHaveLength(1);
        expect(unpushed[0]?.id).toBe(event2.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("replay", () => {
    it("returns all events in chronological order", () => {
      const { db, sqlite } = createEventsDb();
      try {
        const repo = new EventLogRepository(db);
        repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
          timestamp: "2026-01-02T00:00:00.000Z",
          pushed: false,
        });
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "plan_to_watch",
          newValue: "watching",
          timestamp: "2026-01-01T00:00:00.000Z",
          pushed: false,
        });

        const replayed = repo.replay();
        expect(replayed).toHaveLength(2);
        expect(replayed[0]?.entityId).toBe(1);
        expect(replayed[1]?.entityId).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("clear", () => {
    it("removes all events", () => {
      const { db, sqlite } = createEventsDb();
      try {
        const repo = new EventLogRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
          timestamp: "2026-01-01T00:00:00.000Z",
          pushed: false,
        });

        repo.clear();

        const all = repo.replay();
        expect(all).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });
});
