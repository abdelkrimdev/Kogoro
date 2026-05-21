import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CredentialStore, createCredentialStore } from "../config/credential-store";
import { createMockKeytar, silentBunSecrets, stubBunSecrets } from "../test-fixtures";

describe("CredentialStore", () => {
  let mockKeytar: ReturnType<typeof createMockKeytar>;

  const originalEnv = process.env;

  beforeEach(() => {
    mockKeytar = createMockKeytar();
    process.env = { ...originalEnv };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("KOGORO_") && k.endsWith("_KEY")) delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("setCredential stores and getCredential retrieves", async () => {
    const store = new CredentialStore({ keytar: mockKeytar });
    await store.setCredential("anidb", "key123");
    const val = await store.getCredential("anidb");
    expect(val).toBe("key123");
  });

  test("getCredential returns undefined for unset credential", async () => {
    const store = new CredentialStore({ keytar: mockKeytar });
    const val = await store.getCredential("nonexistent");
    expect(val).toBeUndefined();
  });

  test("deleteCredential removes a stored credential", async () => {
    const store = new CredentialStore({ keytar: mockKeytar });
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
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature
    process.env["KOGORO_TVDB_KEY"] = "tvdb-key";
    const store = new CredentialStore({ keytar: null });
    const val = await store.getCredential("tvdb");
    expect(val).toBe("tvdb-key");
  });

  test("keytar takes priority over env var", async () => {
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature
    process.env["KOGORO_ANIDB_KEY"] = "env-key";
    const store = new CredentialStore({ keytar: mockKeytar });
    await store.setCredential("anidb", "keytar-key");
    const val = await store.getCredential("anidb");
    expect(val).toBe("keytar-key");
  });

  test("returns env var when keytar returns null", async () => {
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature
    process.env["KOGORO_ANIDB_KEY"] = "fallback-key";
    const store = new CredentialStore({ keytar: mockKeytar });
    const val = await store.getCredential("anidb");
    expect(val).toBe("fallback-key");
  });

  test("createCredentialStore returns a CredentialStore instance", () => {
    const store = createCredentialStore();
    expect(store).toBeInstanceOf(CredentialStore);
  });
});

describe("createCredentialStore", () => {
  const originalSecrets = Bun.secrets;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    stubBunSecrets(originalSecrets);
    process.env = originalEnv;
  });

  test("returns a CredentialStore with BunSecretsKeytar wired in", () => {
    const store = createCredentialStore();
    expect(store).toBeInstanceOf(CredentialStore);
  });

  test("factory-wired store reads from keyring when env var is absent", async () => {
    const mockStore = new Map<string, string>();
    mockStore.set("kogoro:anidb", "keytar-val");
    stubBunSecrets({
      get: async ({ service, name }: { service: string; name: string }) =>
        mockStore.get(`${service}:${name}`) ?? null,
      set: async ({ service, name, value }: { service: string; name: string; value: string }) => {
        mockStore.set(`${service}:${name}`, value);
      },
      delete: async ({ service, name }: { service: string; name: string }) =>
        mockStore.delete(`${service}:${name}`),
    });
    const store = createCredentialStore();
    const val = await store.getCredential("anidb");
    expect(val).toBe("keytar-val");
  });

  test("factory-wired store falls through to env var when keyring returns null", async () => {
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature
    process.env["KOGORO_ANIDB_KEY"] = "env-val";
    stubBunSecrets(silentBunSecrets());
    const store = createCredentialStore();
    const val = await store.getCredential("anidb");
    expect(val).toBe("env-val");
  });

  test("factory-wired store returns undefined when neither keyring nor env var has value", async () => {
    stubBunSecrets(silentBunSecrets());
    const store = createCredentialStore();
    const val = await store.getCredential("nonexistent");
    expect(val).toBeUndefined();
  });
});
