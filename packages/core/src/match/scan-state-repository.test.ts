import { describe, expect, test } from "bun:test";
import { ScanStateRepository } from "./scan-state-repository";
import { createMatchCacheDb } from "./test-utils";

describe("ScanStateRepository", () => {
  test("setScanState stores entry and getScanState retrieves it", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new ScanStateRepository(db);
      repo.set("/path/to/file.mkv", 1024, 1700000000, "abc123");
      const result = repo.get("/path/to/file.mkv");
      expect(result).toEqual({ size: 1024, mtime: 1700000000, hash: "abc123" });
    } finally {
      sqlite.close();
    }
  });

  test("get returns null for missing path", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new ScanStateRepository(db);
      expect(repo.get("/nonexistent")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("setScanState overwrites existing entry", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new ScanStateRepository(db);
      repo.set("/path/file.mkv", 100, 1000, "hash1");
      repo.set("/path/file.mkv", 200, 2000, "hash2");
      expect(repo.get("/path/file.mkv")).toEqual({ size: 200, mtime: 2000, hash: "hash2" });
    } finally {
      sqlite.close();
    }
  });

  test("deleteScanState removes an entry", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new ScanStateRepository(db);
      repo.set("/path/file.mkv", 100, 1000, "hash");
      repo.delete("/path/file.mkv");
      expect(repo.get("/path/file.mkv")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("getBatch returns entries for multiple paths", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new ScanStateRepository(db);
      repo.set("/a.mkv", 100, 1000, "hashA");
      repo.set("/b.mkv", 200, 2000, "hashB");
      repo.set("/c.mkv", 300, 3000, "hashC");
      const result = repo.getBatch(["/a.mkv", "/b.mkv", "/missing.mkv"]);
      expect(result.size).toBe(2);
      expect(result.get("/a.mkv")).toEqual({ size: 100, mtime: 1000, hash: "hashA" });
      expect(result.get("/b.mkv")).toEqual({ size: 200, mtime: 2000, hash: "hashB" });
      expect(result.has("/missing.mkv")).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  test("deleteBatch removes multiple entries", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new ScanStateRepository(db);
      repo.set("/a.mkv", 100, 1000, "hashA");
      repo.set("/b.mkv", 200, 2000, "hashB");
      repo.set("/c.mkv", 300, 3000, "hashC");
      repo.deleteBatch(["/a.mkv", "/c.mkv"]);
      expect(repo.get("/a.mkv")).toBeNull();
      expect(repo.get("/b.mkv")).toEqual({ size: 200, mtime: 2000, hash: "hashB" });
      expect(repo.get("/c.mkv")).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
