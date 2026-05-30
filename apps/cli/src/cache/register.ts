import type yargs from "yargs";
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
          () => {
            const handlers = createCacheHandlers();
            console.log(JSON.stringify(handlers.list()));
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
          (argv) => {
            const handlers = createCacheHandlers();
            console.log(JSON.stringify(handlers.lookup(argv.hash)));
          },
        )
        .command(
          "clear",
          "Clear all cached Match entries",
          () => {},
          () => {
            const handlers = createCacheHandlers();
            console.log(JSON.stringify(handlers.clear()));
          },
        )
        .demandCommand(1, "Please specify a cache action: list, lookup, or clear"),
    () => {},
  );
}
