import type {
  ImportPreview,
  ImportResult,
  ImportSelection,
  LibraryService,
  TrackerSource,
} from "@kogoro/core";
import { TrackerImportService } from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

interface TrackerImportHandlerOptions {
  libraryService: LibraryService;
  pluginFactory: PluginFactory;
}

export function createTrackerImportHandlers(options: TrackerImportHandlerOptions) {
  const { libraryService, pluginFactory } = options;
  const activeServices = new Map<string, { service: TrackerImportService; timestamp: number }>();
  const SERVICE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function cleanupExpiredServices(): void {
    const now = Date.now();
    for (const [key, entry] of activeServices) {
      if (now - entry.timestamp > SERVICE_TTL_MS) {
        entry.service.clearCache();
        activeServices.delete(key);
      }
    }
  }

  return {
    async getImportPreview(params: {
      trackerName: string;
    }): Promise<{ preview: ImportPreview | null; error?: string }> {
      const { trackerName } = params;
      cleanupExpiredServices();

      const tracker = await pluginFactory.tracker(trackerName);
      if (!tracker) {
        return { preview: null, error: `Tracker "${trackerName}" is not connected` };
      }

      const service = new TrackerImportService(
        libraryService,
        tracker,
        trackerName as TrackerSource,
      );
      activeServices.set(trackerName, { service, timestamp: Date.now() });

      try {
        const preview = await service.getImportPreview();
        return { preview };
      } catch (err) {
        activeServices.delete(trackerName);
        return {
          preview: null,
          error: `Failed to get preview: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },

    async confirmImport(params: {
      trackerName: string;
      selections?: ImportSelection[];
    }): Promise<{ result: ImportResult | null; error?: string }> {
      const { trackerName, selections } = params;
      cleanupExpiredServices();

      const entry = activeServices.get(trackerName);
      let service: TrackerImportService;
      if (entry) {
        service = entry.service;
        activeServices.delete(trackerName);
      } else {
        const tracker = await pluginFactory.tracker(trackerName);
        if (!tracker) {
          return { result: null, error: `Tracker "${trackerName}" is not connected` };
        }

        service = new TrackerImportService(libraryService, tracker, trackerName as TrackerSource);
      }

      try {
        const result = await service.confirmImport(selections);
        return { result };
      } catch (err) {
        return {
          result: null,
          error: `Failed to import: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
