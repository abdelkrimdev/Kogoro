import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CredentialStore, LibraryService, TrackerError } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepository,
  createMockKeytar,
} from "@kogoro/core/testing";
import {
  cancelTrackerAuth,
  connectTracker,
  disconnectTracker,
  getTrackerConnectionFields,
  getTrackerStatus,
  startTrackerAuth,
  waitForTrackerCallback,
} from "./tracker-connections";

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

describe("getTrackerStatus", () => {
  test("returns not-connected status when no credentials stored", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const status = await getTrackerStatus(store);
    expect(status).toHaveLength(3);
    expect(status.find((t) => t.name === "anilist")?.connected).toBe(false);
    expect(status.find((t) => t.name === "kitsu")?.connected).toBe(false);
    expect(status.find((t) => t.name === "mal")?.connected).toBe(false);
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

  test("returns connected status for kitsu with JSON blob credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const credential = JSON.stringify({
      access_token: "test-token",
      refresh_token: "refresh-token",
      expires_at: Date.now() + 3600000,
    });
    await store.setCredential("kitsu", credential);
    const status = await getTrackerStatus(store);
    const kitsu = status.find((t) => t.name === "kitsu");
    expect(kitsu?.connected).toBe(true);
    expect(kitsu?.accountInfo).toBe("Connected");
  });

  test("returns connected status for anilist with JSON blob credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const credential = JSON.stringify({
      access_token: "test-token",
      expires_at: Date.now() + 3600000,
    });
    await store.setCredential("anilist", credential);
    const status = await getTrackerStatus(store);
    const anilist = status.find((t) => t.name === "anilist");
    expect(anilist?.connected).toBe(true);
    expect(anilist?.accountInfo).toBe("Connected");
  });

  test("returns display names for all trackers", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const status = await getTrackerStatus(store);
    expect(status.map((t) => t.displayName)).toEqual(["AniList", "Kitsu", "MyAnimeList"]);
  });
});

describe("getTrackerConnectionFields", () => {
  test("returns empty fields for anilist (callback flow)", () => {
    const fields = getTrackerConnectionFields("anilist");
    expect(fields).toHaveLength(0);
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

  test("returns empty fields for mal (callback flow)", () => {
    const fields = getTrackerConnectionFields("mal");
    expect(fields).toHaveLength(0);
  });
});

describe("connectTracker", () => {
  test("stores anilist credential via onBeforeStore callback flow", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const credential = JSON.stringify({
      access_token: "anilist-implicit-token",
      expires_at: Date.now() + 3600000,
    });
    const result = await connectTracker(store, {
      name: "anilist",
      values: {},
      onBeforeStore: async () => credential,
    });
    expect(result.success).toBe(true);
    expect(await store.getCredential("anilist")).toBe(credential);
  });

  test("returns error for anilist without onBeforeStore (callback flow required)", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
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

  test("returns error for anilist with empty onBeforeStore", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: {},
      onBeforeStore: async () => null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
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

  test("returns error for mal without onBeforeStore (callback flow required)", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "mal",
      values: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("stores mal credential via onBeforeStore callback flow", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const credential = JSON.stringify({
      access_token: "exchanged-mal-token",
      expires_at: Date.now() + 3600000,
    });
    const result = await connectTracker(store, {
      name: "mal",
      values: {},
      onBeforeStore: async () => credential,
    });
    expect(result.success).toBe(true);
    expect(await store.getCredential("mal")).toBe(credential);
  });

  test("returns error for unknown tracker", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "invalid",
      values: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid");
  });
});

describe("disconnectTracker", () => {
  let service: LibraryService;
  let evtRepo: ReturnType<typeof createEventRepository>["repo"];
  let closeService: () => void;
  let closeEvtService: () => void;

  beforeEach(() => {
    const { repo, close } = createLibraryRepository();
    const { repo: er, close: closeEvt } = createEventRepository();
    service = new LibraryService(repo, er);
    evtRepo = er;
    closeService = close;
    closeEvtService = closeEvt;
  });

  afterEach(() => {
    closeEvtService();
    closeService();
  });

  test("deletes anilist credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("anilist", "token");
    const result = await disconnectTracker(store, service, evtRepo, { name: "anilist" });
    expect(result.success).toBe(true);
    expect(await store.getCredential("anilist")).toBeUndefined();
  });

  test("deletes kitsu credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("kitsu", "user:pass");
    const result = await disconnectTracker(store, service, evtRepo, { name: "kitsu" });
    expect(result.success).toBe(true);
    expect(await store.getCredential("kitsu")).toBeUndefined();
  });

  test("deletes mal credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("mal", "token");
    const result = await disconnectTracker(store, service, evtRepo, { name: "mal" });
    expect(result.success).toBe(true);
    expect(await store.getCredential("mal")).toBeUndefined();
  });

  test("returns error for unknown tracker", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await disconnectTracker(store, service, evtRepo, { name: "invalid" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid");
  });

  test("succeeds when no credential exists", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await disconnectTracker(store, service, evtRepo, { name: "anilist" });
    expect(result.success).toBe(true);
  });

  test("removes all tracker mappings for disconnected source", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("anilist", "token");

    const anime = service.upsertAnime({
      externalId: "tvdb-12345",
      sourceDb: "tvdb",
      title: "Jujutsu Kaisen",
      episodeCount: 24,
    });

    const group = service.upsertEpisodeGroup({
      animeId: anime.id,
      entryType: "tv",
      seasonNumber: 1,
      watchStatus: "watching",
    });

    service.upsertGroupTrackerMapping({
      groupId: group.id,
      source: "anilist",
      externalId: "anilist-67890",
    });
    service.upsertGroupTrackerMapping({
      groupId: group.id,
      source: "kitsu",
      externalId: "kitsu-11111",
    });

    const result = await disconnectTracker(store, service, evtRepo, { name: "anilist" });
    expect(result.success).toBe(true);
    expect(await store.getCredential("anilist")).toBeUndefined();

    const remainingMappings = service.getTrackerMappingsByGroupId(group.id);
    expect(remainingMappings).toHaveLength(1);
    expect(remainingMappings[0]?.source).toBe("kitsu");
  });

  test("preserves library data when disconnecting", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("anilist", "token");

    const anime = service.upsertAnime({
      externalId: "tvdb-12345",
      sourceDb: "tvdb",
      title: "Jujutsu Kaisen",
      episodeCount: 24,
    });

    const group = service.upsertEpisodeGroup({
      animeId: anime.id,
      entryType: "tv",
      seasonNumber: 1,
      watchStatus: "watching",
    });

    service.upsertGroupTrackerMapping({
      groupId: group.id,
      source: "anilist",
      externalId: "anilist-67890",
    });

    await disconnectTracker(store, service, evtRepo, { name: "anilist" });

    const animeAfter = service.getAnime(anime.id);
    expect(animeAfter).not.toBeNull();
    expect(animeAfter?.title).toBe("Jujutsu Kaisen");

    const groupsAfter = service.getEpisodeGroupsByAnimeId(anime.id);
    expect(groupsAfter).toHaveLength(1);
  });

  test("drops pending events for disconnected source", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("anilist", "token");

    const anime = service.upsertAnime({
      externalId: "tvdb-12345",
      sourceDb: "tvdb",
      title: "Jujutsu Kaisen",
      episodeCount: 24,
    });

    const group = service.upsertEpisodeGroup({
      animeId: anime.id,
      entryType: "tv",
      seasonNumber: 1,
      watchStatus: "watching",
    });

    const event = evtRepo.append({
      entityType: "group",
      entityId: group.id,
      eventType: "status_change",
      oldValue: "watching",
      newValue: "completed",
    });
    evtRepo.markPushedForSource([event.id], "anilist");

    expect(evtRepo.getUnpushed("anilist")).toHaveLength(0);

    await disconnectTracker(store, service, evtRepo, { name: "anilist" });

    expect(evtRepo.getUnpushed("anilist")).toHaveLength(1);
    expect(evtRepo.getUnpushed("anilist")[0]?.id).toBe(event.id);
  });
});

describe("startTrackerAuth", () => {
  afterEach(async () => {
    await cancelTrackerAuth();
  });

  test("returns auth URL for anilist with implicit grant (response_type=token)", async () => {
    const result = await startTrackerAuth("anilist");

    expect(result.authUrl).toContain("anilist.co/api/v2/oauth/authorize");
    expect(result.authUrl).toContain("client_id=45221");
    expect(result.authUrl).toContain("response_type=token");
    expect(result.state).toBeDefined();
    expect(result.state.length).toBe(64);
  });

  test("returns auth URL for mal with hardcoded client ID and PKCE parameters", async () => {
    const result = await startTrackerAuth("mal");

    expect(result.authUrl).toContain("myanimelist.net/v1/oauth2/authorize");
    expect(result.authUrl).toContain("client_id=97e4bfe9c07f9e679ec96e4906862030");
    expect(result.authUrl).toContain("response_type=code");
    expect(result.authUrl).toContain("code_challenge_method=plain");
    expect(result.authUrl).toContain("scope=write%3Ausers");
    expect(result.authUrl).toContain("state=");
    expect(result.authUrl).toContain("redirect_uri=");
    expect(result.authUrl).toContain("localhost%3A43219%2Fcallback%2Fmal");
    expect(result.state).toBeDefined();
    expect(result.state.length).toBe(64);
  });

  test("stores MAL code verifier in credential store for later exchange", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await startTrackerAuth("mal", store);

    const verifier = await store.getCredential("mal_code_verifier");
    expect(verifier).toBeDefined();
    expect(verifier?.length).toBeGreaterThan(0);

    const url = new URL(result.authUrl);
    expect(url.searchParams.get("code_challenge")).toBe(verifier ?? null);
  });

  test("throws for unsupported tracker", async () => {
    await expect(startTrackerAuth("kitsu")).rejects.toThrow(TrackerError);
  });

  test("works without environment variables set", async () => {
    delete process.env["ANILIST_CLIENT_ID"];
    delete process.env["MAL_CLIENT_ID"];

    const anilistResult = await startTrackerAuth("anilist");
    expect(anilistResult.authUrl).toContain("client_id=45221");

    const malResult = await startTrackerAuth("mal");
    expect(malResult.authUrl).toContain("client_id=97e4bfe9c07f9e679ec96e4906862030");
  });
});

describe("waitForTrackerCallback", () => {
  afterEach(async () => {
    await cancelTrackerAuth();
  });

  test("returns a promise", async () => {
    const result = waitForTrackerCallback("test-state");
    expect(result).toBeInstanceOf(Promise);
    await cancelTrackerAuth();
  });

  test("resolves when cancelled", async () => {
    await startTrackerAuth("anilist");

    const callbackPromise = waitForTrackerCallback("test-state");

    setTimeout(() => cancelTrackerAuth(), 50);

    const result = await callbackPromise;
    expect(result.code).toBe("");
    expect(result.state).toBe("");
  });
});
