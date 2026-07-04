import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CredentialStore, LibraryService } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepository,
  createMockKeytar,
} from "@kogoro/core/testing";
import {
  connectTracker,
  disconnectTracker,
  getTrackerConnectionFields,
  getTrackerStatus,
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

  test("returns display names for all trackers", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const status = await getTrackerStatus(store);
    expect(status.map((t) => t.displayName)).toEqual(["AniList", "Kitsu", "MyAnimeList"]);
  });
});

describe("getTrackerConnectionFields", () => {
  test("returns pin field for anilist", () => {
    const fields = getTrackerConnectionFields("anilist");
    expect(fields).toHaveLength(1);
    expect(fields[0]?.name).toBe("pin");
    expect(fields[0]?.type).toBe("text");
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

  test("returns token field for mal", () => {
    const fields = getTrackerConnectionFields("mal");
    expect(fields).toHaveLength(1);
    expect(fields[0]?.name).toBe("token");
    expect(fields[0]?.type).toBe("password");
  });
});

describe("connectTracker", () => {
  test("stores anilist pin credential via onBeforeStore", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: { pin: "123456" },
      onBeforeStore: async () => "exchanged-anilist-token",
    });
    expect(result.success).toBe(true);
    expect(await store.getCredential("anilist")).toBe("exchanged-anilist-token");
  });

  test("stores anilist pin directly when no onBeforeStore", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: { pin: "my-anilist-token" },
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

  test("returns error when anilist pin is empty", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "anilist",
      values: { pin: "" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("PIN Code");
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

  test("stores mal token credential", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "mal",
      values: { token: "my-mal-token" },
    });
    expect(result.success).toBe(true);
    expect(await store.getCredential("mal")).toBe("my-mal-token");
  });

  test("returns error when mal token is empty", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await connectTracker(store, {
      name: "mal",
      values: { token: "" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Token");
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
