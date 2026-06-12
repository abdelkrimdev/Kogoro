import type { CacheService } from "@kogoro/core";
import type yargs from "yargs";
import { wrapCommand } from "../wrap";
import { createCacheHandlers } from "./handlers";

export function registerCache(
  parser: ReturnType<typeof yargs>,
  options: { cacheService: CacheService },
): void {
  parser.command(
    "cache",
    "Manage the Match cache (SQLite database keyed by file hash)",
    (yargs) =>
      yargs
        .command(
          "list",
          "List all cached Match entries",
          () => {},
          async () => {
            const handlers = createCacheHandlers(options);
            await wrapCommand(async () => handlers.list());
          },
        )
        .command(
          "lookup <hash>",
          "Look up a cached Match by file hash",
          (yargs) =>
            yargs.positional("hash", {
              type: "string",
              demandOption: true,
              describe: "SHA-256 hash of the file",
            }),
          async (argv) => {
            const handlers = createCacheHandlers(options);
            await wrapCommand(async () => handlers.lookup(argv.hash));
          },
        )
        .command(
          "clear",
          "Clear all cached Match entries",
          () => {},
          async () => {
            const handlers = createCacheHandlers(options);
            await wrapCommand(async () => handlers.clear());
          },
        )
        .command(
          "purge [paths..]",
          "Remove stale cache entries not present in the given paths",
          (yargs) =>
            yargs.positional("paths", {
              type: "string",
              array: true,
              describe: "Current file paths to keep (omit to clear all)",
            }),
          async (argv) => {
            const handlers = createCacheHandlers(options);
            await wrapCommand(async () => handlers.purge(argv.paths ?? []));
          },
        )
        .demandCommand(1, "Please specify a cache action: list, lookup, clear, or purge"),
    () => {},
  );
}
