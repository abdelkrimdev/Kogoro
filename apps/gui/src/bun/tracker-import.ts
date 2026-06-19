import type { CredentialStore, LibraryService, TrackerPlugin, TrackerSource } from "@kogoro/core";
import { HttpClient } from "@kogoro/core/io/http-client";
import {
  type ImportPreview,
  type ImportResult,
  type ImportSelection,
  TrackerImportService,
} from "@kogoro/core/tracker-import";
import { AniListPlugin, KitsuPlugin } from "@kogoro/plugins";

interface TrackerImportHandlerOptions {
  libraryService: LibraryService;
  credentialStore: CredentialStore;
}

async function createTrackerPlugin(
  name: string,
  credentialStore: CredentialStore,
): Promise<TrackerPlugin | undefined> {
  const credential = await credentialStore.getCredential(name);
  if (!credential) return undefined;

  const httpClient = new HttpClient({ minDelay: 500 });

  switch (name) {
    case "anilist":
      return new AniListPlugin({ token: credential, httpClient });
    case "kitsu": {
      const [username, password] = credential.split(":", 2);
      return new KitsuPlugin({
        httpClient,
        username: username ?? credential,
        password: password ?? "",
      });
    }
    default:
      return undefined;
  }
}

export function createTrackerImportHandlers(options: TrackerImportHandlerOptions) {
  const { libraryService, credentialStore } = options;

  return {
    async getImportPreview(params: {
      trackerName: string;
    }): Promise<{ preview: ImportPreview | null; error?: string }> {
      const { trackerName } = params;

      const tracker = await createTrackerPlugin(trackerName, credentialStore);
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

      const tracker = await createTrackerPlugin(trackerName, credentialStore);
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
