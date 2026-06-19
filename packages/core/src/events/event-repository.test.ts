import { describe, expect, test } from "bun:test";
import { EventRepository } from "./event-repository";
import { createEventDb } from "./test-utils";

function at<T>(arr: T[], i: number): T {
  return arr[i] as T;
}

describe("EventRepository", () => {
  describe("append", () => {
    test("creates event with all fields and pushed=empty", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const event = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        expect(event.id).toBe(1);
        expect(event.entityType).toBe("group");
        expect(event.entityId).toBe(1);
        expect(event.eventType).toBe("status_change");
        expect(event.oldValue).toBe("watching");
        expect(event.newValue).toBe("completed");
        expect(event.timestamp).toBeTruthy();
        expect(event.pushed).toEqual([]);
      } finally {
        sqlite.close();
      }
    });

    test("returns incrementing ids", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        const e2 = repo.append({
          entityType: "episode",
          entityId: 2,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
        });

        expect(e1.id).toBe(1);
        expect(e2.id).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("replay", () => {
    test("returns all events ordered by timestamp", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "episode",
          entityId: 2,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
        });

        const result = repo.replay();
        expect(result).toHaveLength(2);
        expect(at(result, 0).entityType).toBe("group");
        expect(at(result, 1).entityType).toBe("episode");
        expect(at(result, 0).timestamp <= at(result, 1).timestamp).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("returns empty array when no events", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const result = repo.replay();
        expect(result).toEqual([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAllForEntity", () => {
    test("returns events for specific entity", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "status_change",
          oldValue: null,
          newValue: "completed",
        });
        repo.append({
          entityType: "episode",
          entityId: 1,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
        });

        const result = repo.getAllForEntity("group", 1);
        expect(result).toHaveLength(1);
        expect(at(result, 0).entityId).toBe(1);
        expect(at(result, 0).entityType).toBe("group");
      } finally {
        sqlite.close();
      }
    });

    test("returns full history for entity", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        const result = repo.getAllForEntity("group", 1);
        expect(result).toHaveLength(2);
        expect(at(result, 0).newValue).toBe("watching");
        expect(at(result, 1).newValue).toBe("completed");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getUnpushed", () => {
    test("returns events with empty pushed array", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "status_change",
          oldValue: null,
          newValue: "completed",
        });

        const result = repo.getUnpushed();
        expect(result).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    test("excludes events pushed to all sources", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "status_change",
          oldValue: null,
          newValue: "completed",
        });
        repo.markPushed([e1.id], ["mal", "anilist"]);

        const result = repo.getUnpushed();
        expect(result).toHaveLength(1);
        expect(at(result, 0).entityId).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("filters by source when provided", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "status_change",
          oldValue: null,
          newValue: "completed",
        });
        repo.markPushedForSource([e1.id], "mal");

        const malUnpushed = repo.getUnpushed("mal");
        expect(malUnpushed).toHaveLength(1);
        expect(at(malUnpushed, 0).entityId).toBe(2);

        const anilistUnpushed = repo.getUnpushed("anilist");
        expect(anilistUnpushed).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("markPushed", () => {
    test("sets pushed to provided sources", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.markPushed([e1.id], ["mal", "anilist"]);

        const unpushed = repo.getUnpushed();
        expect(unpushed).toHaveLength(0);

        const all = repo.replay();
        expect(at(all, 0).pushed).toEqual(["mal", "anilist"]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("markPushedForSource", () => {
    test("adds source to pushed array", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.markPushedForSource([e1.id], "mal");

        const malUnpushed = repo.getUnpushed("mal");
        expect(malUnpushed).toHaveLength(0);

        const anilistUnpushed = repo.getUnpushed("anilist");
        expect(anilistUnpushed).toHaveLength(1);

        const all = repo.replay();
        expect(at(all, 0).pushed).toEqual(["mal"]);
      } finally {
        sqlite.close();
      }
    });

    test("does not duplicate source", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.markPushedForSource([e1.id], "mal");
        repo.markPushedForSource([e1.id], "mal");

        const all = repo.replay();
        expect(at(all, 0).pushed).toEqual(["mal"]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("dropForSource", () => {
    test("removes source from pushed arrays", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        const e1 = repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        const e2 = repo.append({
          entityType: "group",
          entityId: 2,
          eventType: "status_change",
          oldValue: null,
          newValue: "completed",
        });
        repo.markPushed([e1.id], ["mal", "anilist"]);
        repo.markPushedForSource([e2.id], "mal");

        repo.dropForSource("mal");

        const all = repo.replay();
        expect(at(all, 0).pushed).toEqual(["anilist"]);
        expect(at(all, 1).pushed).toEqual([]);

        const malUnpushed = repo.getUnpushed("mal");
        expect(malUnpushed).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("idempotent replay", () => {
    test("replaying events produces same result", () => {
      const { db, sqlite } = createEventDb();
      try {
        const repo = new EventRepository(db);
        repo.append({
          entityType: "group",
          entityId: 1,
          eventType: "status_change",
          oldValue: null,
          newValue: "watching",
        });
        repo.append({
          entityType: "episode",
          entityId: 2,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
        });

        const first = repo.replay();
        const second = repo.replay();
        expect(first).toEqual(second);
        expect(first).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });
  });
});
