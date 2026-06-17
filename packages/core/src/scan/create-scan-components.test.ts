import { describe, expect, test } from "bun:test";
import { createMatchCacheService, createMockDb, withTestConfig } from "../fixtures";
import { createScanComponents } from "./create-scan-components";

describe("createScanComponents", () => {
  test("returns renamer configured from config templates", async () => {
    await withTestConfig("pipeline", async (_dir, config) => {
      const { cacheService } = createMatchCacheService();
      const pipeline = createScanComponents({ config, cacheService });

      expect(pipeline.renamer).toBeDefined();
      expect(pipeline.matcher).toBeUndefined();
      expect(pipeline.overrideStore).toBeDefined();
      expect(pipeline.scanner).toBeDefined();
      expect(typeof pipeline.walk).toBe("function");
    });
  });

  test("returns matcher and scanner when database is provided", async () => {
    await withTestConfig("pipeline-db", async (_dir, config) => {
      const database = createMockDb();
      const { cacheService } = createMatchCacheService();
      const pipeline = createScanComponents({ config, database, cacheService });

      expect(pipeline.matcher).toBeDefined();
      expect(pipeline.scanner).toBeDefined();
    });
  });

  test("returns scanner with no matcher when no database", async () => {
    await withTestConfig("pipeline-no-db", async (_dir, config) => {
      const { cacheService } = createMatchCacheService();
      const pipeline = createScanComponents({ config, cacheService });

      expect(pipeline.matcher).toBeUndefined();
      expect(pipeline.scanner).toBeDefined();
    });
  });

  test("accepts renamer override", async () => {
    await withTestConfig("pipeline-renamer", async (_dir, config) => {
      const { Renamer } = await import("../rename/renamer");
      const customRenamer = new Renamer({
        filenameTemplate: "custom.{ext}",
        directoryTemplate: "out",
      });

      const { cacheService } = createMatchCacheService();
      const pipeline = createScanComponents({ config, renamer: customRenamer, cacheService });

      expect(pipeline.renamer).toBe(customRenamer);
    });
  });

  test("accepts overrideStore override", async () => {
    await withTestConfig("pipeline-store", async (dir, config) => {
      const { OverrideStore } = await import("../match/override-store");
      const customStore = new OverrideStore(dir);

      const { cacheService } = createMatchCacheService();
      const pipeline = createScanComponents({ config, overrideStore: customStore, cacheService });

      expect(pipeline.overrideStore).toBe(customStore);
    });
  });

  test("scanner returns failed status when no database is configured", async () => {
    await withTestConfig("pipeline-no-db-scan", async (_dir, config) => {
      const { cacheService } = createMatchCacheService();
      const pipeline = createScanComponents({ config, cacheService });
      const result = await pipeline.scanner.scanFile("[Group] My Anime - 01.mkv");

      expect(result.status).toBe("failed");
      expect(result.failureReason).toBe("No database configured");
    });
  });
});
