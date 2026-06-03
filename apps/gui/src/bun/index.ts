import { join } from "node:path";
import type { EntryType } from "@kogoro/core";
import {
  CONFIG_DIR,
  ConfigManager,
  createCredentialStore,
  LibraryDb,
  MatchCache,
  Matcher,
  OverrideStore,
  Renamer,
  SCHEMA_DEFAULTS,
  Scanner,
  walk,
} from "@kogoro/core";
import { PluginFactory } from "@kogoro/plugins";
import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import { shouldShowOnboarding } from "./onboarding";
import {
  cleanupSession,
  createScanOrchestrator,
  findCandidateMatches,
  getMatcher,
  getOrchestrator,
} from "./scan";
import { applySettingsUpdate, buildSettingsFormData } from "./settings";
import { loadThemeMode, loadWindowState, saveThemeMode, saveWindowState } from "./state";

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();

const libraryHandlers = createLibraryHandlers(CONFIG_DIR);

function createEnrichment() {
  return createEnrichmentHandlers({
    configManager,
    credentialStore,
    configDir: CONFIG_DIR,
    send: {
      enrichmentProgress: (data) => rpc.send.enrichmentProgress(data),
      enrichmentComplete: (data) => rpc.send.enrichmentComplete(data),
    },
  });
}

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      getWindowState: () => {
        return savedState;
      },
      checkOnboarding: () => {
        return { needsOnboarding: shouldShowOnboarding(CONFIG_DIR) };
      },
      writeOnboardingConfig: async (params) => {
        const { primaryDb, apiKey, templatePreset, templateCustom } = params;
        const result1 = configManager.set("primary-db", primaryDb);
        if (!result1.success) return { success: false, error: result1.error };
        const result2 = configManager.set("template.preset", templatePreset);
        if (!result2.success) return { success: false, error: result2.error };
        if (templateCustom) {
          const result3 = configManager.set("template.custom", templateCustom);
          if (!result3.success) return { success: false, error: result3.error };
        }
        if (apiKey) {
          try {
            await credentialStore.setCredential(primaryDb, apiKey);
          } catch (err) {
            return {
              success: false,
              error: `Failed to store API key: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
        return { success: true };
      },
      getLibrary: () => libraryHandlers.getLibrary(),
      getLibraryStats: () => libraryHandlers.getLibraryStats(),
      getAnimeDetail: (params) => libraryHandlers.getAnimeDetail(params),
      getWatchStatusByAnime: (params) => libraryHandlers.getWatchStatusByAnime(params),
      setWatchStatus: (params) => libraryHandlers.setWatchStatus(params),
      getSettingsData: async () => {
        const apiKeys: Record<string, string | undefined> = {};
        for (const plugin of ["tvdb", "anidb", "opensubtitles"]) {
          try {
            apiKeys[plugin] = (await credentialStore.getCredential(plugin)) ?? undefined;
          } catch {
            apiKeys[plugin] = undefined;
          }
        }
        return buildSettingsFormData(configManager, apiKeys);
      },
      updateSettings: async (params) => {
        return applySettingsUpdate(configManager, params);
      },
      updateApiKey: async (params) => {
        const { plugin, apiKey } = params;
        if (!apiKey) {
          try {
            await credentialStore.deleteCredential(plugin);
          } catch (err) {
            return {
              success: false,
              error: `Failed to delete API key: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
          return { success: true };
        }
        try {
          await credentialStore.setCredential(plugin, apiKey);
        } catch (err) {
          return {
            success: false,
            error: `Failed to store API key: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
        return { success: true };
      },
      togglePlugin: async (params) => {
        const { plugin, enabled } = params;
        const result = configManager.set(`plugins.${plugin}.enabled`, String(enabled));
        if (!result.success) return { success: false, error: result.error };
        return { success: true };
      },
      scanStart: async (params) => {
        const { path } = params;
        const sessionId = crypto.randomUUID();
        const orchestrator = await createScanOrchestrator(
          sessionId,
          configManager,
          credentialStore,
        );

        orchestrator.on("*", (event) => {
          switch (event.type) {
            case "scanProgress":
              rpc.send.scanProgress(event);
              break;
            case "scanPhaseComplete":
              rpc.send.scanPhaseComplete(event);
              break;
            case "scanReviewReady":
              rpc.send.scanReviewReady(event);
              break;
            case "scanExecutionProgress":
              rpc.send.scanExecutionProgress(event);
              break;
            case "scanComplete":
              rpc.send.scanComplete(event);
              cleanupSession(sessionId);
              break;
          }
        });

        orchestrator.startScan(path).catch((err) => {
          console.error("Scan failed:", err);
        });

        return { sessionId };
      },
      approvePlan: async (params) => {
        const { sessionId } = params;
        const orchestrator = getOrchestrator(sessionId);
        await orchestrator.approvePlan();

        const matches = orchestrator.getMatchResults();
        const sourceDb = configManager.get("primary-db");
        if (matches.length > 0 && typeof sourceDb === "string" && sourceDb) {
          const dbPath = join(CONFIG_DIR, "library.db");
          const db = new LibraryDb({ dbPath });
          try {
            db.rebuildFromMatches(matches, sourceDb);
          } finally {
            db.close();
          }
        }

        return undefined;
      },
      rejectPlan: async (params) => {
        const { sessionId } = params;
        getOrchestrator(sessionId).rejectPlan();
        return undefined;
      },
      approveGroup: async (params) => {
        const { sessionId, animeId } = params;
        getOrchestrator(sessionId).approveGroup(animeId);
        return undefined;
      },
      rejectGroup: async (params) => {
        const { sessionId, animeId } = params;
        getOrchestrator(sessionId).rejectGroup(animeId);
        return undefined;
      },
      cancelScan: async (params) => {
        const { sessionId } = params;
        getOrchestrator(sessionId).cancel();
        cleanupSession(sessionId);
        return undefined;
      },
      swapFiles: async (params) => {
        const { sessionId, fileAId, fileBId } = params;
        getOrchestrator(sessionId).swapFiles(fileAId, fileBId);
        return undefined;
      },
      getResolveCandidates: async (params) => {
        const { sessionId, fileId } = params;
        const orchestrator = getOrchestrator(sessionId);
        const plan = orchestrator.getPlan();
        if (!plan) return { candidates: [] };

        let sourcePath: string | null = null;
        for (const group of plan.groups) {
          for (const file of group.files) {
            if (file.fileId === fileId) {
              sourcePath = file.sourcePath;
              break;
            }
          }
          if (sourcePath) break;
        }
        if (!sourcePath) return { candidates: [] };

        const matcher = getMatcher(sessionId);
        if (!matcher) return { candidates: [] };

        const { best } = await findCandidateMatches(matcher, sourcePath);

        return {
          candidates: best.map((m) => ({
            animeId: m.anime.id,
            animeTitle: m.anime.titleEn,
            entryType: m.anime.entryType,
            episodeId: m.episode?.id ?? "",
            episodeNumber: m.episode?.episode ?? 0,
            season: m.episode?.season ?? 1,
            score: m.score,
          })),
        };
      },
      resolveMatch: async (params) => {
        const { sessionId, fileId, animeId, episodeId } = params;
        await getOrchestrator(sessionId).resolveMatch(fileId, animeId, episodeId);
        return undefined;
      },
      enrichArtwork: async (params) => {
        return createEnrichment().enrichArtwork(params);
      },
      enrichMetadata: async (params) => {
        return createEnrichment().enrichMetadata(params);
      },
      getThemeMode: () => {
        const mode = loadThemeMode();
        return mode ? { mode } : null;
      },
      setThemeMode: (params) => {
        saveThemeMode(params.mode);
        return { success: true };
      },
      rebuildLibrary: async () => {
        const paths = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        const dir = paths[0];
        if (!dir) return { success: false, error: "No directory selected" };

        try {
          const factory = new PluginFactory(configManager, credentialStore);
          const database = await factory.primaryDatabase();
          if (!database) return { success: false, error: "No primary database configured" };

          const matcher = new Matcher({ database });
          const cache = new MatchCache();
          const overrideStore = new OverrideStore(CONFIG_DIR);

          const template = configManager.getTemplate();
          const filenameTemplate = template.includes("{ext}") ? template : `${template}.{ext}`;
          const directoryTemplate =
            (configManager.get("template.directory") as string) ??
            SCHEMA_DEFAULTS.template.directory;

          const renamer = new Renamer({ filenameTemplate, directoryTemplate });
          const scanner = new Scanner({ matcher, cache, renamer, overrideStore });

          const files = await walk(dir, SCHEMA_DEFAULTS["media-extensions"], {
            excludePatterns: configManager.getList("exclude-patterns"),
          });

          const matches: Array<{
            animeId: string;
            animeTitle: string;
            entryType: EntryType;
            episodeId: string | null;
            episode: number | null;
            season: number | null;
            title: string | null;
            filePath: string;
          }> = [];

          for (const file of files) {
            try {
              const result = await scanner.scanFile(file, { dryRun: true });
              if (result.match && (result.status === "matched" || result.status === "cached")) {
                matches.push({
                  animeId: result.match.anime.id,
                  animeTitle: result.match.anime.titleEn,
                  entryType: result.match.anime.entryType,
                  episodeId: result.match.episode?.id ?? null,
                  episode: result.match.episode?.episode ?? null,
                  season: result.match.episode?.season ?? null,
                  title: result.match.episode?.titleEn ?? null,
                  filePath: result.file,
                });
              }
            } catch {
              // skip files that fail to scan
            }
          }

          if (matches.length > 0) {
            const sourceDb = configManager.get("primary-db");
            if (typeof sourceDb === "string" && sourceDb) {
              const dbPath = join(CONFIG_DIR, "library.db");
              const db = new LibraryDb({ dbPath });
              try {
                db.rebuildFromMatches(matches, sourceDb);
              } finally {
                db.close();
              }
            }
          }

          return { success: true };
        } catch (err) {
          return {
            success: false,
            error: `Rebuild failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    },
    messages: {
      windowWillClose: (data) => {
        saveWindowState({ x: data.x, y: data.y, width: data.width, height: data.height });
      },
    },
  },
});

const defaultFrame = { width: 1200, height: 800, x: 200, y: 200 };

const webviewUrl = process.env["VITE_DEV_SERVER_URL"] || "views://mainview/index.html";

const win = new BrowserWindow({
  title: "Kogoro",
  titleBarStyle: "hiddenInset",
  url: webviewUrl,
  frame: savedState
    ? { width: savedState.width, height: savedState.height, x: savedState.x, y: savedState.y }
    : defaultFrame,
  rpc,
});

const needsOnboarding = shouldShowOnboarding(CONFIG_DIR);
if (needsOnboarding) {
  rpc.send.showOnboarding({});
}

win.on("resize", (event: unknown) => {
  const e = event as { data: { x: number; y: number; width: number; height: number } };
  saveWindowState({ x: e.data.x, y: e.data.y, width: e.data.width, height: e.data.height });
});

win.on("move", () => {
  const frame = win.getFrame();
  saveWindowState({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
});
