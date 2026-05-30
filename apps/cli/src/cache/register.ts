import type yargs from "yargs";
import { wrapCommand } from "../wrap";
import { createCacheHandlers } from "./handlers";

export function registerCache(parser: ReturnType<typeof yargs>): void {
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
            const handlers = createCacheHandlers();
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
            const handlers = createCacheHandlers();
            await wrapCommand(async () => handlers.lookup(argv.hash));
          },
        )
        .command(
          "clear",
          "Clear all cached Match entries",
          () => {},
          async () => {
            const handlers = createCacheHandlers();
            await wrapCommand(async () => handlers.clear());
          },
        )
        .demandCommand(1, "Please specify a cache action: list, lookup, or clear"),
    () => {},
  );
}
