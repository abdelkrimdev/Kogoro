import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BunSecretsKeytar } from "../src/config/bun-secrets-keytar.ts";

describe("BunSecretsKeytar", () => {
  const mockStore = new Map<string, string>();
  const originalSecrets = Bun.secrets;

  beforeEach(() => {
    mockStore.clear();
    (Bun as any).secrets = {
      get: async ({ service, name }: { service: string; name: string }) =>
        mockStore.get(`${service}:${name}`) ?? null,
      set: async ({ service, name, value }: { service: string; name: string; value: string }) => {
        mockStore.set(`${service}:${name}`, value);
      },
      delete: async ({ service, name }: { service: string; name: string }) =>
        mockStore.delete(`${service}:${name}`),
    };
  });

  afterEach(() => {
    (Bun as any).secrets = originalSecrets;
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

  test("getPassword returns null when Bun.secrets.get returns null", async () => {
    (Bun as any).secrets = {
      get: async () => null,
      set: async () => {},
      delete: async () => false,
    };
    const keytar = new BunSecretsKeytar();
    const val = await keytar.getPassword("kogoro", "any");
    expect(val).toBeNull();
  });

  test("getPassword swallows errors and returns null", async () => {
    (Bun as any).secrets = {
      get: async () => {
        throw new Error("keyring unavailable");
      },
      set: async () => {},
      delete: async () => false,
    };
    const keytar = new BunSecretsKeytar();
    const val = await keytar.getPassword("kogoro", "any");
    expect(val).toBeNull();
  });

  test("deletePassword swallows errors and returns false", async () => {
    (Bun as any).secrets = {
      get: async () => null,
      set: async () => {},
      delete: async () => {
        throw new Error("keyring unavailable");
      },
    };
    const keytar = new BunSecretsKeytar();
    const result = await keytar.deletePassword("kogoro", "any");
    expect(result).toBe(false);
  });

  test("setPassword propagates errors to caller", async () => {
    (Bun as any).secrets = {
      get: async () => null,
      set: async () => {
        throw new Error("keyring unavailable");
      },
      delete: async () => false,
    };
    const keytar = new BunSecretsKeytar();
    await expect(keytar.setPassword("kogoro", "any", "secret")).rejects.toThrow(
      "keyring unavailable",
    );
  });
});
