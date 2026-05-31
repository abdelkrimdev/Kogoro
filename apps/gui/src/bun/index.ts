import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { MatchResult, ParsedResult } from "@kogoro/core";
import {
  bestPerAnimeId,
  CONFIG_DIR,
  ConfigManager,
  createCredentialStore,
  MatchCache,
  Matcher,
  OverrideStore,
  parse,
  Renamer,
  SCHEMA_DEFAULTS,
  Scanner,
  ScanOrchestrator,
  walk,
} from "@kogoro/core";
import { PluginFactory } from "@kogoro/plugins";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import { shouldShowOnboarding } from "./onboarding";
import { buildSettingsFormData } from "./settings";

const STATE_FILE = join(import.meta.dir, "../../.window-state.json");

function loadWindowState(): { x: number; y: number; width: number; height: number } | null {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

function saveWindowState(state: { x: number; y: number; width: number; height: number }) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // ignore write errors
  }
}

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();

const libraryHandlers = createLibraryHandlers(CONFIG_DIR);

const scanOrchestrators = new Map<string, ScanOrchestrator>();
const scanMatchers = new Map<string, Matcher>();

function getOrchestrator(sessionId: string): ScanOrchestrator {
  const orchestrator = scanOrchestrators.get(sessionId);
  if (!orchestrator) {
    throw new Error("Scan session not found");
  }
  return orchestrator;
}

async function findCandidateMatches(
  matcher: Matcher,
  filePath: string,
): Promise<{ parsed: ParsedResult; best: MatchResult[] }> {
  const parsed = parse(basename(filePath));
  const matches = await matcher.match(parsed);
  const scoredMatches = matches.filter((m) => !m.failureReason);
  const hasEpisode = parsed.episode !== null;
  const goodMatches = scoredMatches.filter((m) => (hasEpisode ? m.episode !== undefined : true));
  const best = bestPerAnimeId(goodMatches);
  return { parsed, best };
}

async function createScanOrchestrator(sessionId: string): Promise<ScanOrchestrator> {
  const factory = new PluginFactory(configManager, credentialStore);
  const database = await factory.primaryDatabase();

  const matcher = database ? new Matcher({ database }) : undefined;
  const cache = new MatchCache();
  const overrideStore = new OverrideStore(CONFIG_DIR);

  const filenameTemplate = configManager.getTemplate();
  const directoryTemplate =
    (configManager.get("template.directory") as string) ?? SCHEMA_DEFAULTS.template.directory;
  const renamer = new Renamer({
    filenameTemplate: filenameTemplate.includes("{ext}")
      ? filenameTemplate
      : `${filenameTemplate}.{ext}`,
    directoryTemplate,
  });

  const scanner = matcher ? new Scanner({ matcher, cache, renamer, overrideStore }) : undefined;

  if (matcher) {
    scanMatchers.set(sessionId, matcher);
  }

  const orchestrator = new ScanOrchestrator({
    scanner: { match: async () => [], matchBatch: async () => [] },
    walk: async (path: string) =>
      walk(path, SCHEMA_DEFAULTS["media-extensions"], {
        excludePatterns: configManager.getList("exclude-patterns"),
      }),
    scanFile: async (filePath: string, options?: { dryRun?: boolean }) => {
      if (!scanner) {
        return {
          file: filePath,
          hash: "",
          parsed: {
            title: null,
            season: null,
            episode: null,
            tags: { group: null, resolution: null, source: null, codec: null, audio: null },
          },
          match: null,
          plan: null,
          cached: false,
          skipped: false,
          status: "failed" as const,
          failureReason: "No database configured",
        };
      }
      return scanner.scanFile(filePath, { dryRun: options?.dryRun ?? true });
    },
    resolveFile: matcher
      ? async (filePath: string, animeId: string, episodeId: string) => {
          const { parsed, best } = await findCandidateMatches(matcher, filePath);

          const chosen = best.find((m) => m.anime.id === animeId && m.episode?.id === episodeId);

          if (!chosen) {
            return {
              file: filePath,
              hash: "",
              parsed,
              match: null,
              plan: null,
              cached: false,
              skipped: false,
              status: "failed" as const,
              failureReason: "Selected candidate not found",
            };
          }

          const extension = extname(filePath).replace(".", "") || "mkv";
          const plan = renamer.plan(filePath, chosen, extension);

          return {
            file: filePath,
            hash: "",
            parsed,
            match: chosen,
            plan,
            cached: false,
            skipped: false,
            status: "matched" as const,
          };
        }
      : undefined,
    executeRename: scanner
      ? async (plan, baseDir) => {
          const result = renamer.execute(plan, baseDir);
          return { success: result.success, error: result.error };
        }
      : undefined,
  });

  scanOrchestrators.set(sessionId, orchestrator);
  return orchestrator;
}

async function handleEnrichment(params: { id: string }, command: "artwork" | "metadata") {
  const send = rpc.send as unknown as {
    enrichmentProgress?: (data: unknown) => void;
    enrichmentComplete?: (data: unknown) => void;
  };
  const enrichment = createEnrichmentHandlers({
    configManager,
    credentialStore,
    configDir: CONFIG_DIR,
    send: {
      enrichmentProgress: (data) => send.enrichmentProgress?.(data),
      enrichmentComplete: (data) => send.enrichmentComplete?.(data),
    },
  });
  const result =
    command === "artwork"
      ? await enrichment.enrichArtwork(params)
      : await enrichment.enrichMetadata(params);
  send.enrichmentComplete?.({
    animeId: params.id,
    command,
    success: result.success,
    error: result.error,
  });
  return result;
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
        // Set primary-db
        const result1 = configManager.set("primary-db", primaryDb);
        if (!result1.success) return { success: false, error: result1.error };
        // Set template
        const result2 = configManager.set("template.preset", templatePreset);
        if (!result2.success) return { success: false, error: result2.error };
        if (templateCustom) {
          const result3 = configManager.set("template.custom", templateCustom);
          if (!result3.success) return { success: false, error: result3.error };
        }
        // Store API key if provided
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
      getAnimeDetail: (params) => libraryHandlers.getAnimeDetail(params),
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
        const fieldMap: Record<string, string> = {
          primaryDb: "primary-db",
          secondaryDbs: "secondary-dbs",
          templatePreset: "template.preset",
          templateCustom: "template.custom",
          directoryTemplate: "template.directory",
          mediaExtensions: "media-extensions",
          excludePatterns: "exclude-patterns",
          scanConcurrency: "scan-concurrency",
          fetchConcurrency: "fetch-concurrency",
          episodeNumbering: "episode-numbering",
          renameAction: "rename-action",
          subtitleLanguage: "subtitle-language",
        };

        for (const [key, value] of Object.entries(params)) {
          if (value === undefined) continue;
          const configKey = fieldMap[key];
          if (!configKey) continue;
          const result = configManager.set(configKey, String(value));
          if (!result.success) return { success: false, error: result.error };
        }
        return { success: true };
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
        const orchestrator = await createScanOrchestrator(sessionId);

        const send = rpc.send as unknown as {
          scanProgress?: (data: unknown) => void;
          scanPhaseComplete?: (data: unknown) => void;
          scanReviewReady?: (data: unknown) => void;
          scanExecutionProgress?: (data: unknown) => void;
          scanComplete?: (data: unknown) => void;
        };

        orchestrator.on("*", (event) => {
          switch (event.type) {
            case "scanProgress":
              send.scanProgress?.(event);
              break;
            case "scanPhaseComplete":
              send.scanPhaseComplete?.(event);
              break;
            case "scanReviewReady":
              send.scanReviewReady?.(event);
              break;
            case "scanExecutionProgress":
              send.scanExecutionProgress?.(event);
              break;
            case "scanComplete":
              send.scanComplete?.(event);
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
        await getOrchestrator(sessionId).approvePlan();
        return undefined;
      },
      rejectPlan: async (params) => {
        const { sessionId } = params;
        getOrchestrator(sessionId).rejectPlan();
        return undefined;
      },
      cancelScan: async (params) => {
        const { sessionId } = params;
        getOrchestrator(sessionId).cancel();
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

        const matcher = scanMatchers.get(sessionId);
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
        return handleEnrichment(params, "artwork") as unknown as {
          success: boolean;
          summary?: { total: number; downloaded: number; skipped: number; noArtwork: number };
          error?: string;
        };
      },
      enrichMetadata: async (params) => {
        return handleEnrichment(params, "metadata") as unknown as {
          success: boolean;
          summary?: { total: number; written: number; skipped: number; failed: number };
          error?: string;
        };
      },
    },
    messages: {
      "*": () => {},
    },
  },
});

const defaultFrame = { width: 1200, height: 800, x: 200, y: 200 };

const win = new BrowserWindow({
  title: "Kogoro",
  titleBarStyle: "hiddenInset",
  url: "views://mainview/index.html",
  frame: savedState
    ? { width: savedState.width, height: savedState.height, x: savedState.x, y: savedState.y }
    : defaultFrame,
  rpc,
});

// Determine which view to show
const needsOnboarding = shouldShowOnboarding(CONFIG_DIR);
const send = rpc.send as unknown as { showOnboarding?: () => void; showMainApp?: () => void };
if (needsOnboarding) {
  send.showOnboarding?.();
} else {
  send.showMainApp?.();
}

win.on("resize", (event: unknown) => {
  const e = event as { data: { x: number; y: number; width: number; height: number } };
  saveWindowState({ x: e.data.x, y: e.data.y, width: e.data.width, height: e.data.height });
});

win.on("move", () => {
  const frame = win.getFrame();
  saveWindowState({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
});
