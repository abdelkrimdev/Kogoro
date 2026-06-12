import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { withTempDir, writeTempFile } from "../fixtures";
import { ScanStateRepository } from "./scan-state-repository";
import { ScanStateService } from "./scan-state-service";
import { createMatchCacheDb } from "./test-utils";

describe("ScanStateService", () => {
  describe("isFileUpToDate", () => {
    test("returns stored hash when size and mtime match", () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        repo.set("/media/ep1.mkv", 1024, 5000, "abc123");

        const hash = service.isFileUpToDate("/media/ep1.mkv", 1024, 5000);

        expect(hash).toBe("abc123");
      } finally {
        sqlite.close();
      }
    });

    test("returns null when size differs", () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        repo.set("/media/ep1.mkv", 1024, 5000, "abc123");

        const hash = service.isFileUpToDate("/media/ep1.mkv", 2048, 5000);

        expect(hash).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("returns null when mtime differs", () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        repo.set("/media/ep1.mkv", 1024, 5000, "abc123");

        const hash = service.isFileUpToDate("/media/ep1.mkv", 1024, 6000);

        expect(hash).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("returns null for unknown path", () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        const hash = service.isFileUpToDate("/media/new.mkv", 1024, 5000);

        expect(hash).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("setFromFs", () => {
    test("stores scan state from file stats", async () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        await withTempDir("setFromFs", async (dir) => {
          const filePath = writeTempFile(dir, "ep1.mkv", "video content");
          const stat = statSync(filePath);

          service.setFromFs(filePath, "abc123");

          const stored = repo.get(filePath);
          expect(stored).not.toBeNull();
          expect(stored?.hash).toBe("abc123");
          expect(stored?.size).toBe(stat.size);
          expect(stored?.mtime).toBe(Math.floor(stat.mtimeMs / 1000));
        });
      } finally {
        sqlite.close();
      }
    });

    test("overwrites existing scan state", async () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        await withTempDir("setFromFs-overwrite", async (dir) => {
          const filePath = writeTempFile(dir, "ep1.mkv", "original content");
          service.setFromFs(filePath, "old-hash");

          const updatedPath = writeTempFile(dir, "ep1.mkv", "updated content");
          service.setFromFs(updatedPath, "new-hash");

          const stored = repo.get(updatedPath);
          expect(stored?.hash).toBe("new-hash");
        });
      } finally {
        sqlite.close();
      }
    });
  });

  describe("moveRename", () => {
    test("deletes old path and stores new path with file stats", async () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const repo = new ScanStateRepository(db);
        const service = new ScanStateService(repo);

        await withTempDir("moveRename", async (dir) => {
          const oldPath = writeTempFile(dir, "old-name.mkv", "video content");
          service.setFromFs(oldPath, "abc123");

          const newPath = `${dir}/new-name.mkv`;
          const { renameSync } = await import("node:fs");
          renameSync(oldPath, newPath);

          service.moveRename(oldPath, newPath, "abc123");

          expect(repo.get(oldPath)).toBeNull();
          const stored = repo.get(newPath);
          expect(stored).not.toBeNull();
          expect(stored?.hash).toBe("abc123");
        });
      } finally {
        sqlite.close();
      }
    });
  });
});
