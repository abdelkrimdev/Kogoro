import { describe, expect, test } from "bun:test";
import { createMockKeytar } from "../fixtures";
import type { KeytarLike } from "./bun-secrets-keytar";
import { checkKeyring } from "./check-keyring";

describe("checkKeyring", () => {
  test("returns available when keyring works", async () => {
    const keytar = createMockKeytar();
    const result = await checkKeyring(keytar, "linux");
    expect(result.available).toBe(true);
    expect(result.platform).toBe("linux");
    expect(result.reason).toBeUndefined();
  });

  test("classifies D-Bus errors as unavailable", async () => {
    const failingKeytar: KeytarLike = {
      setPassword: async () => {
        throw new Error("org.freedesktop.DBus.Error.NotSupported");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    const result = await checkKeyring(failingKeytar, "linux");
    expect(result.available).toBe(false);
    expect(result.reason).toBe("unavailable");
    expect(result.platform).toBe("linux");
  });

  test("classifies macOS keychain errors as locked", async () => {
    const failingKeytar: KeytarLike = {
      setPassword: async () => {
        throw new Error("SecKeychainOpen: The user name or passphrase you entered is not correct");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    const result = await checkKeyring(failingKeytar, "darwin");
    expect(result.available).toBe(false);
    expect(result.reason).toBe("locked");
  });

  test("classifies permission errors as access_denied", async () => {
    const failingKeytar: KeytarLike = {
      setPassword: async () => {
        throw new Error("Permission denied");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    const result = await checkKeyring(failingKeytar, "linux");
    expect(result.available).toBe(false);
    expect(result.reason).toBe("access_denied");
  });

  test("classifies unknown errors as unknown", async () => {
    const failingKeytar: KeytarLike = {
      setPassword: async () => {
        throw new Error("something weird happened");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    const result = await checkKeyring(failingKeytar, "linux");
    expect(result.available).toBe(false);
    expect(result.reason).toBe("unknown");
  });
});
