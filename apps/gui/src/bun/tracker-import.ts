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

  return {
    async getImportPreview(params: {
      trackerName: string;
    }): Promise<{ preview: ImportPreview | null; error?: string }> {
      const { trackerName } = params;

      const tracker = await pluginFactory.tracker(trackerName);
      if (!tracker) {
        return { preview: null, error: `Tracker "${trackerName}" is not connected` };
      }

      const service = new TrackerImportService(
        libraryService,
        tracker,
        trackerName as TrackerSource,
      );

      try {
        const preview = await service.getImportPreview();
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

      const service = new TrackerImportService(
        libraryService,
        tracker,
        trackerName as TrackerSource,
      );

      try {
        if (selections) {
          for (const selection of selections) {
            if (selection.groupId) {
              service.linkEntry(selection.trackerId, selection.groupId);
            }
            if (selection.resolution) {
              service.resolveConflict(selection.trackerId, selection.resolution);
            }
          }
        }

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
