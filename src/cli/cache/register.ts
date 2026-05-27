import { confirm, isCancel, log } from "@clack/prompts";
import type yargs from "yargs";
import { createDisplay } from "../output";
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
          async (argv) => {
            const handlers = createCacheHandlers();
            await handlers.list(
              // biome-ignore lint/complexity/useLiteralKeys: yargs index signature
              createDisplay(!!argv["json"], (msg) => log.error(msg)),
              (msg) => log.error(msg),
            );
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
            await handlers.lookup(
              argv.hash,
              // biome-ignore lint/complexity/useLiteralKeys: yargs index signature
              createDisplay(!!argv["json"], (msg) => log.error(msg)),
              (msg) => log.error(msg),
            );
          },
        )
        .command(
          "clear",
          "Clear all cached Match entries (requires confirmation)",
          (yargs) => yargs.hide("json").hide("debug"),
          async () => {
            const handlers = createCacheHandlers();
            const response = await confirm({
              message: "Are you sure you want to clear the entire Match cache?",
            });
            const confirmed = !isCancel(response) && response === true;
            await handlers.clear(
              confirmed,
              (msg) => log.message(msg),
              (msg) => log.error(msg),
            );
          },
        )
        .demandCommand(1, "Please specify a cache action: list, lookup, or clear"),
    () => {},
  );
}
