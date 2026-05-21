import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BunSecretsKeytar } from "../config/bun-secrets-keytar";
import { silentBunSecrets, stubBunSecrets } from "../test-fixtures";

describe("BunSecretsKeytar", () => {
  const mockStore = new Map<string, string>();
  const originalSecrets = Bun.secrets;

  beforeEach(() => {
    mockStore.clear();
    stubBunSecrets({
      get: async ({ service, name }: { service: string; name: string }) =>
        mockStore.get(`${service}:${name}`) ?? null,
      set: async ({ service, name, value }: { service: string; name: string; value: string }) => {
        mockStore.set(`${service}:${name}`, value);
      },
      delete: async ({ service, name }: { service: string; name: string }) =>
        mockStore.delete(`${service}:${name}`),
    });
  });

  afterEach(() => {
    stubBunSecrets(originalSecrets);
  });

  test("setPassword stores and getPassword retrieves a credential", async () => {
    const keytar = new BunSecretsKeytar();
    await keytar.setPassword("kogoro", "anidb", "secret-key");
    const val = await keytar.getPassword("kogoro", "anidb");
    expect(val).toBe("secret-key");
  });

  test("getPassword returns null for unset credential", async () => {
    const keytar = new BunSecretsKeytar();
    const val = await keytar.getPassword("kogoro", "nonexistent");
    expect(val).toBeNull();
  });

  test("deletePassword removes a stored credential and returns true", async () => {
    const keytar = new BunSecretsKeytar();
    await keytar.setPassword("kogoro", "anidb", "secret-key");
    const deleted = await keytar.deletePassword("kogoro", "anidb");
    expect(deleted).toBe(true);
    const val = await keytar.getPassword("kogoro", "anidb");
    expect(val).toBeNull();
  });

  test("deletePassword returns false for unset credential", async () => {
    const keytar = new BunSecretsKeytar();
    const deleted = await keytar.deletePassword("kogoro", "nonexistent");
    expect(deleted).toBe(false);
  });

  test("getPassword normalizes undefined to null", async () => {
    stubBunSecrets({
      ...silentBunSecrets(),
      // biome-ignore lint/suspicious/noExplicitAny: Bun.get returns a string or undefined, type system expects only string
      get: async () => undefined as any,
    });
    const keytar = new BunSecretsKeytar();
    const val = await keytar.getPassword("kogoro", "any");
    expect(val).toBeNull();
  });

  test("getPassword returns null when Bun.secrets.get returns null", async () => {
    stubBunSecrets(silentBunSecrets());
    const keytar = new BunSecretsKeytar();
    const val = await keytar.getPassword("kogoro", "any");
    expect(val).toBeNull();
  });

  test("getPassword swallows errors and returns null", async () => {
    stubBunSecrets({
      ...silentBunSecrets(),
      get: async () => {
        throw new Error("keyring unavailable");
      },
    });
    const keytar = new BunSecretsKeytar();
    const val = await keytar.getPassword("kogoro", "any");
    expect(val).toBeNull();
  });

  test("deletePassword swallows errors and returns false", async () => {
    stubBunSecrets({
      ...silentBunSecrets(),
      delete: async () => {
        throw new Error("keyring unavailable");
      },
    });
    const keytar = new BunSecretsKeytar();
    const result = await keytar.deletePassword("kogoro", "any");
    expect(result).toBe(false);
  });

  test("setPassword propagates errors to caller", async () => {
    stubBunSecrets({
      ...silentBunSecrets(),
      set: async () => {
        throw new Error("keyring unavailable");
      },
    });
    const keytar = new BunSecretsKeytar();
    await expect(keytar.setPassword("kogoro", "any", "secret")).rejects.toThrow(
      "keyring unavailable",
    );
  });
});
