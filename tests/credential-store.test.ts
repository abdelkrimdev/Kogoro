import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CredentialStore } from "../src/config/credential-store.ts";

describe("CredentialStore", () => {
  const mockKeytar = {
    store: new Map<string, string>(),
    setPassword(_service: string, _account: string, password: string): Promise<void> {
      this.store.set(`${_service}:${_account}`, password);
      return Promise.resolve();
    },
    getPassword(_service: string, _account: string): Promise<string | null> {
      return Promise.resolve(this.store.get(`${_service}:${_account}`) ?? null);
    },
    deletePassword(_service: string, _account: string): Promise<boolean> {
      return Promise.resolve(this.store.delete(`${_service}:${_account}`));
    },
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockKeytar.store.clear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("setCredential stores and getCredential retrieves", async () => {
    const store = new CredentialStore({ keytar: mockKeytar as never });
    await store.setCredential("anidb", "key123");
    const val = await store.getCredential("anidb");
    expect(val).toBe("key123");
  });

  test("getCredential returns undefined for unset credential", async () => {
    const store = new CredentialStore({ keytar: mockKeytar as never });
    const val = await store.getCredential("nonexistent");
    expect(val).toBeUndefined();
  });

  test("deleteCredential removes a stored credential", async () => {
    const store = new CredentialStore({ keytar: mockKeytar as never });
    await store.setCredential("anidb", "key123");
    await store.deleteCredential("anidb");
    const val = await store.getCredential("anidb");
    expect(val).toBeUndefined();
  });

  test("falls back to env var when keytar is unavailable", async () => {
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature
    process.env["KOGORO_ANIDB_KEY"] = "env-key-456";
    const store = new CredentialStore({ keytar: null });
    const val = await store.getCredential("anidb");
    expect(val).toBe("env-key-456");
  });

  test("env var naming convention is KOGORO_{SERVICE}_KEY", async () => {
    process.env["KOGORO_TVDB_KEY"] = "tvdb-key";
    const store = new CredentialStore({ keytar: null });
    const val = await store.getCredential("tvdb");
    expect(val).toBe("tvdb-key");
  });

  test("keytar takes priority over env var", async () => {
    process.env["KOGORO_ANIDB_KEY"] = "env-key";
    const store = new CredentialStore({ keytar: mockKeytar as never });
    await store.setCredential("anidb", "keytar-key");
    const val = await store.getCredential("anidb");
    expect(val).toBe("keytar-key");
  });

  test("returns env var when keytar returns null", async () => {
    process.env["KOGORO_ANIDB_KEY"] = "fallback-key";
    const store = new CredentialStore({ keytar: mockKeytar as never });
    const val = await store.getCredential("anidb");
    expect(val).toBe("fallback-key");
  });
});
