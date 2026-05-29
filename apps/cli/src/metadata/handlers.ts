import { log } from "@clack/prompts";
import { type ConfigManager, MatchCache, MetadataWriter } from "@kogoro/core";
import type { DatabasePlugin } from "@kogoro/plugins";
import { resolveMediaExtensions } from "../extensions";
import { createProgressTracker } from "../progress";

export interface MetadataHandlerOptions {
  dbPath?: string;
  database?: DatabasePlugin;
  config?: ConfigManager;
}

export function createMetadataHandlers(options: MetadataHandlerOptions = {}) {
  const cache = new MatchCache({ dbPath: options.dbPath });
  const extensions = resolveMediaExtensions(options.config);
  const writer = new MetadataWriter({ cache, database: options.database, extensions });

  return {
    async write(
      path: string,
      cliOptions: { force?: boolean; verbose?: boolean; quiet?: boolean; json?: boolean },
    ): Promise<void> {
      const quiet = cliOptions.quiet ?? cliOptions.json ?? false;
      const tracker = createProgressTracker({
        verbose: cliOptions.verbose,
        quiet,
      });

      tracker.start("Writing metadata...");

      try {
        const summary = await writer.write(path, { force: cliOptions.force }, tracker.ctx);

        tracker.stop(`Written ${summary.written} of ${summary.total}`);

        if (cliOptions.json) {
          log.message(JSON.stringify(summary, null, 2));
        } else {
          const parts: string[] = [`${summary.total} files processed`];
          if (summary.written > 0) parts.push(`${summary.written} NFOs written`);
          if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
          if (summary.failed > 0) parts.push(`${summary.failed} failed`);
          log.message(parts.join(", "));
        }
      } catch (err) {
        tracker.stop("Failed");
        log.error(String(err));
      }
    },
  };
}
