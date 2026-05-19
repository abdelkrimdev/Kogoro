import { describe, expect, test } from "bun:test";
import { BunSecretsKeytar } from "../src/config/bun-secrets-keytar.ts";

function createMockSecrets() {
  const store = new Map<string, string>();
  return {
    async set(opts: { service: string; name: string; value: string }): Promise<void> {
      store.set(`${opts.service}:${opts.name}`, opts.value);
    },
    async get(opts: { service: string; name: string }): Promise<string | undefined> {
      return store.get(`${opts.service}:${opts.name}`);
    },
    async delete(opts: { service: string; name: string }): Promise<boolean> {
      return store.delete(`${opts.service}:${opts.name}`);
    },
  };
}

describe("BunSecretsKeytar", () => {
  test("setPassword stores and getPassword retrieves a credential", async () => {
    const secrets = createMockSecrets();
    const keytar = new BunSecretsKeytar(secrets);

    await keytar.setPassword("kogoro", "tvdb", "api-key-123");
    const result = await keytar.getPassword("kogoro", "tvdb");

    expect(result).toBe("api-key-123");
  });

  test("getPassword returns null for a missing credential", async () => {
    const secrets = createMockSecrets();
    const keytar = new BunSecretsKeytar(secrets);

    const result = await keytar.getPassword("kogoro", "nonexistent");

    expect(result).toBeNull();
  });

  test("deletePassword removes a stored credential", async () => {
    const secrets = createMockSecrets();
    const keytar = new BunSecretsKeytar(secrets);

    await keytar.setPassword("kogoro", "tvdb", "api-key-123");
    const deleted = await keytar.deletePassword("kogoro", "tvdb");
    const result = await keytar.getPassword("kogoro", "tvdb");

    expect(deleted).toBe(true);
    expect(result).toBeNull();
  });

  test("getPassword returns null when Bun.secrets throws", async () => {
    const secrets = {
      async set(): Promise<void> {},
      async get(): Promise<string | undefined> {
        throw new Error("Keyring unavailable");
      },
      async delete(): Promise<boolean> {
        return true;
      },
    };
    const keytar = new BunSecretsKeytar(secrets);

    const result = await keytar.getPassword("kogoro", "tvdb");

    expect(result).toBeNull();
  });

  test("deletePassword returns false when Bun.secrets throws", async () => {
    const secrets = {
      async set(): Promise<void> {},
      async get(): Promise<string | undefined> {
        return undefined;
      },
      async delete(): Promise<boolean> {
        throw new Error("Keyring unavailable");
      },
    };
    const keytar = new BunSecretsKeytar(secrets);

    const result = await keytar.deletePassword("kogoro", "tvdb");

    expect(result).toBe(false);
  });

  test("setPassword propagates errors from Bun.secrets", async () => {
    const secrets = {
      async set(): Promise<void> {
        throw new Error("Keyring unavailable");
      },
      async get(): Promise<string | undefined> {
        return undefined;
      },
      async delete(): Promise<boolean> {
        return true;
      },
    };
    const keytar = new BunSecretsKeytar(secrets);

    await expect(keytar.setPassword("kogoro", "tvdb", "key")).rejects.toThrow(
      "Keyring unavailable",
    );
  });

  test("getPassword normalizes undefined to null", async () => {
    const secrets = {
      async set(): Promise<void> {},
      async get(): Promise<string | undefined> {
        return undefined;
      },
      async delete(): Promise<boolean> {
        return true;
      },
    };
    const keytar = new BunSecretsKeytar(secrets);

    const result = await keytar.getPassword("kogoro", "tvdb");

    expect(result).toBeNull();
  });
});
