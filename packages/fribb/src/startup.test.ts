import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createFribbConnection } from "./client";
import { ensureDataset } from "./dataset";
import {
  createFailingFetch,
  createMockFetch,
  makeRawCollection,
  makeRawEntry,
  withTempDir,
} from "./fixtures";

describe("Fribb startup wiring", () => {
  test("ensureDataset then createFribbConnection produces working client", async () => {
    await withTempDir("startup-normal", async (dir) => {
      const rawEntries = [
        makeRawEntry({ anidb_id: 1, anilist_id: 101, mal_id: 201 }),
        makeRawEntry({ anidb_id: 2, anilist_id: 102, mal_id: 202 }),
      ];
      const rawCollections = [makeRawCollection({ name: "Gundam", ids: [1, 2] })];
      const fetchFn = createMockFetch(rawEntries, { anidb: rawCollections });

      await ensureDataset(dir, { fetch: fetchFn });

      const client = createFribbConnection(join(dir, "fribb.db"));

      const anidbId = await client.resolveToAnidb("anilist", "101");
      expect(anidbId).toBe("1");

      const collection = await client.getCollectionForAnidb("1");
      expect(collection).not.toBeNull();
      expect(collection?.franchiseTitle).toBe("Gundam");
      expect(collection?.members).toContain("1");
      expect(collection?.members).toContain("2");

      const metadata = await client.getMetadata();
      expect(metadata.supportedSources).toContain("anilist");
      expect((metadata as { collectionCount?: number }).collectionCount).toBeGreaterThanOrEqual(1);
    });
  });

  test("graceful degradation when ensureDataset fails and no cached db exists", async () => {
    await withTempDir("startup-no-db", async (dir) => {
      await expect(ensureDataset(dir, { fetch: createFailingFetch() })).rejects.toThrow(
        "Failed to download Fribb dataset and no cached fribb.db exists",
      );

      expect(() => createFribbConnection(join(dir, "fribb.db"))).toThrow();
    });
  });

  test("ensureDataset is idempotent when db is fresh", async () => {
    await withTempDir("startup-idempotent", async (dir) => {
      const rawEntries = [makeRawEntry({ anidb_id: 1 })];
      const fetchFn = createMockFetch(rawEntries);

      await ensureDataset(dir, { fetch: fetchFn });

      let callCount = 0;
      const countingFetch = async (url: string | URL, init?: RequestInit) => {
        callCount++;
        return fetchFn(url, init);
      };

      await ensureDataset(dir, { fetch: countingFetch });
      expect(callCount).toBe(0);
    });
  });
});
