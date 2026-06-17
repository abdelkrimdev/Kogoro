import type { ConfigManager } from "../config/config-manager";
import { CONFIG_DIR, SCHEMA_DEFAULTS, TEMPLATE_PRESETS } from "../config/schema";
import { walk } from "../io/directory-walker";
import type { CacheService } from "../match/cache-service";
import { Matcher } from "../match/matcher";
import { OverrideStore } from "../match/override-store";
import type { ScanStateService } from "../match/scan-state-service";
import { Renamer } from "../rename/renamer";
import type { SanitizeConfig } from "../rename/sanitize";
import type { DatabasePlugin } from "../types";
import { HashCache } from "./hash-cache";
import { Scanner } from "./scanner";

export interface CreateScanComponentsOptions {
  config?: ConfigManager;
  cacheService: CacheService;
  scanStateService?: ScanStateService;
  database?: DatabasePlugin;
  renamer?: Renamer;
  overrideStore?: OverrideStore;
  sourceDb?: string;
}

export interface ScanComponents {
  matcher: Matcher | undefined;
  renamer: Renamer;
  overrideStore: OverrideStore;
  scanner: Scanner;
  walk: (path: string, options?: { extensions?: readonly string[] }) => Promise<string[]>;
}

function resolveFilenameTemplate(config?: ConfigManager): string {
  const template = config ? config.getTemplate() : `${TEMPLATE_PRESETS.standard}.{ext}`;
  if (template.includes("{ext}")) {
    return template;
  }
  return `${template}.{ext}`;
}

function resolveDirectoryTemplate(config?: ConfigManager): string {
  return config?.template.directory ?? SCHEMA_DEFAULTS.template.directory;
}

export function createScanComponents(options: CreateScanComponentsOptions): ScanComponents {
  const { config, cacheService, scanStateService, database, sourceDb: sourceDbOverride } = options;

  const filenameTemplate = resolveFilenameTemplate(config);
  const directoryTemplate = resolveDirectoryTemplate(config);
  const sanitize = config?.sanitize as SanitizeConfig | undefined;

  const renamer =
    options.renamer ??
    new Renamer({
      filenameTemplate,
      directoryTemplate,
      sanitize,
    });

  const overrideStore = options.overrideStore ?? new OverrideStore(CONFIG_DIR);

  const matcher = database ? new Matcher({ database }) : undefined;

  const sourceDb = sourceDbOverride ?? config?.primaryDb ?? "tvdb";

  const hashCache = new HashCache({
    cacheService,
    overrideStore,
    scanStateService,
    sourceDb,
  });

  const scanner = new Scanner({
    matcher,
    hashCache,
    renamer,
    overrideStore,
  });

  const extensions = config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
  const excludePatterns = config?.excludePatterns ?? [...SCHEMA_DEFAULTS["exclude-patterns"]];

  return {
    matcher,
    renamer,
    overrideStore,
    scanner,
    walk: async (path: string, opts?: { extensions?: readonly string[] }) =>
      walk(path, opts?.extensions ?? extensions, { excludePatterns }),
  };
}
