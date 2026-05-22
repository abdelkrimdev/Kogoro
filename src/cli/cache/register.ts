import { confirm, isCancel } from "@clack/prompts";
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
          "List all cached Match entries as JSON",
          () => {},
          async () => {
            const handlers = createCacheHandlers();
            await handlers.list(console.log, console.error);
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
            await handlers.lookup(argv.hash, console.log, console.error);
          },
        )
        .command(
          "clear",
          "Clear all cached Match entries (requires confirmation)",
          () => {},
          async () => {
            const handlers = createCacheHandlers();
            const response = await confirm({
              message: "Are you sure you want to clear the entire Match cache?",
            });
            const confirmed = !isCancel(response) && response === true;
            await handlers.clear(confirmed, console.log, console.error);
          },
        )
        .demandCommand(1, "Please specify a cache action: list, lookup, or clear"),
    () => {},
  );
}
