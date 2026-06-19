import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CredentialStore } from "@kogoro/core";
import { createMockKeytar } from "@kogoro/core/testing";
import {
  connectTracker,
  disconnectTracker,
  getTrackerConnectionFields,
  getTrackerStatus,
} from "./tracker-connections";

describe("getTrackerStatus", () => {
  test("returns not-connected status when no credentials stored", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const status = await getTrackerStatus(store);
    expect(status).toHaveLength(2);
    expect(status.find((t) => t.name === "anilist")?.connected).toBe(false);
    expect(status.find((t) => t.name === "kitsu")?.connected).toBe(false);
  });

  test("returns connected status with account info for anilist", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("anilist", "test-token-12345");
    const status = await getTrackerStatus(store);
    const anilist = status.find((t) => t.name === "anilist");
    expect(anilist?.connected).toBe(true);
  });

  test("returns connected status with username for kitsu", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("kitsu", "myuser:mypass");
    const status = await getTrackerStatus(store);
    const kitsu = status.find((t) => t.name === "kitsu");
    expect(kitsu?.connected).toBe(true);
    expect(kitsu?.accountInfo).toBe("myuser");
  });

  test("returns display names for all trackers", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const status = await getTrackerStatus(store);
    expect(status.map((t) => t.displayName)).toEqual(["AniList", "Kitsu"]);
  });
});

describe("getTrackerConnectionFields", () => {
  test("returns token field for anilist", () => {
    const fields = getTrackerConnectionFields("anilist");
    expect(fields).toHaveLength(1);
    expect(fields[0]?.name).toBe("token");
    expect(fields[0]?.type).toBe("password");
  });

  test("returns username and password fields for kitsu", () => {
    const fields = getTrackerConnectionFields("kitsu");
    expect(fields).toHaveLength(2);
    const [usernameField, passwordField] = fields;
    expect(usernameField?.name).toBe("username");
    expect(usernameField?.type).toBe("text");
    expect(passwordField?.name).toBe("password");
    expect(passwordField?.type).toBe("password");
  });
});

describe("connectTracker", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("KOGORO_") && k.endsWith("_KEY")) delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("stores anilist token credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: { token: "my-anilist-token" },
    });
    expect(result.success).toBe(true);
    expect(await store.getCredential("anilist")).toBe("my-anilist-token");
  });

  test("stores kitsu username:password credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "kitsu",
      values: { username: "myuser", password: "mypass" },
    });
    expect(result.success).toBe(true);
    expect(await store.getCredential("kitsu")).toBe("myuser:mypass");
  });

  test("returns error when anilist token is empty", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: { token: "" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Token");
  });

  test("returns error when kitsu username is missing", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "kitsu",
      values: { password: "mypass" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("returns error for unknown tracker", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "mal",
      values: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("mal");
  });
});

describe("disconnectTracker", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("KOGORO_") && k.endsWith("_KEY")) delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("deletes anilist credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("anilist", "token");
    const result = await disconnectTracker(store, { name: "anilist" });
    expect(result.success).toBe(true);
    expect(await store.getCredential("anilist")).toBeUndefined();
  });

  test("deletes kitsu credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("kitsu", "user:pass");
    const result = await disconnectTracker(store, { name: "kitsu" });
    expect(result.success).toBe(true);
    expect(await store.getCredential("kitsu")).toBeUndefined();
  });

  test("returns error for unknown tracker", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await disconnectTracker(store, { name: "mal" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("mal");
  });

  test("succeeds when no credential exists", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await disconnectTracker(store, { name: "anilist" });
    expect(result.success).toBe(true);
  });
});
