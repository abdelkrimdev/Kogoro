import { describe, expect, test } from "bun:test";
import { createMockDb, withTestConfig } from "../fixtures";
import { createScanPipeline } from "./create-scan-pipeline";

describe("createScanPipeline", () => {
  test("returns renamer configured from config templates", async () => {
    await withTestConfig("pipeline", async (_dir, config) => {
      const pipeline = createScanPipeline({ config });

      expect(pipeline.renamer).toBeDefined();
      expect(pipeline.matcher).toBeUndefined();
      expect(pipeline.overrideStore).toBeDefined();
      expect(pipeline.scanner).toBeUndefined();
      expect(typeof pipeline.walk).toBe("function");
    });
  });

  test("returns matcher and scanner when database is provided", async () => {
    await withTestConfig("pipeline-db", async (_dir, config) => {
      const database = createMockDb();
      const pipeline = createScanPipeline({ config, database });

      expect(pipeline.matcher).toBeDefined();
      expect(pipeline.scanner).toBeDefined();
    });
  });

  test("returns undefined matcher and scanner when no database", async () => {
    await withTestConfig("pipeline-no-db", async (_dir, config) => {
      const pipeline = createScanPipeline({ config });

      expect(pipeline.matcher).toBeUndefined();
      expect(pipeline.scanner).toBeUndefined();
    });
  });

  test("accepts renamer override", async () => {
    await withTestConfig("pipeline-renamer", async (_dir, config) => {
      const { Renamer } = await import("../rename/renamer");
      const customRenamer = new Renamer({
        filenameTemplate: "custom.{ext}",
        directoryTemplate: "out",
      });

      const pipeline = createScanPipeline({ config, renamer: customRenamer });

      expect(pipeline.renamer).toBe(customRenamer);
    });
  });

  test("accepts overrideStore override", async () => {
    await withTestConfig("pipeline-store", async (dir, config) => {
      const { OverrideStore } = await import("../match/override-store");
      const customStore = new OverrideStore(dir);

      const pipeline = createScanPipeline({ config, overrideStore: customStore });

      expect(pipeline.overrideStore).toBe(customStore);
    });
  });
});
