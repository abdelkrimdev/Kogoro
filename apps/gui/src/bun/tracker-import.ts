import type {
  AnimeAggregate,
  ImportPreview,
  ImportResult,
  ImportSelection,
  TrackerSource,
} from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

interface TrackerImportHandlerOptions {
  animeAggregate: AnimeAggregate;
  pluginFactory: PluginFactory;
}

export function createTrackerImportHandlers(options: TrackerImportHandlerOptions) {
  const { animeAggregate, pluginFactory } = options;

  let importing = false;

  return {
    get isImporting() {
      return importing;
    },

    async getImportPreview(params: {
      trackerName: string;
    }): Promise<{ preview: ImportPreview | null; error?: string }> {
      const { trackerName } = params;

      const tracker = await pluginFactory.tracker(trackerName);
      if (!tracker) {
        return { preview: null, error: `Tracker "${trackerName}" is not connected` };
      }

      try {
        const preview = await animeAggregate.getImportPreview(
          tracker,
          trackerName as TrackerSource,
        );
        return { preview };
      } catch (err) {
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

      const tracker = await pluginFactory.tracker(trackerName);
      if (!tracker) {
        return { result: null, error: `Tracker "${trackerName}" is not connected` };
      }

      importing = true;
      try {
        const result = await animeAggregate.importFromTracker(
          tracker,
          trackerName as TrackerSource,
          selections,
        );
        return { result };
      } catch (err) {
        return {
          result: null,
          error: `Failed to import: ${err instanceof Error ? err.message : String(err)}`,
        };
      } finally {
        importing = false;
      }
    },
  };
}
