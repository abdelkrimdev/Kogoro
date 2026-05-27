import { log } from "@clack/prompts";
import type yargs from "yargs";

export type MetadataHandlerFactory = (debug?: boolean) => Promise<
  | {
      write(
        path: string,
        force: boolean,
        onLog: (msg: string) => void,
        onError: (msg: string) => void,
      ): Promise<void>;
    }
  | undefined
>;

export function registerMetadata(
  parser: ReturnType<typeof yargs>,
  createHandlers: MetadataHandlerFactory,
): void {
  parser.command(
    "metadata <path>",
    "Write missing .nfo metadata sidecar files",
    (yargs) =>
      yargs
        .positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to the organized anime directory",
        })
        .option("force", {
          type: "boolean",
          default: false,
          describe: "Overwrite existing .nfo files",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv["debug"] as boolean | undefined);
      if (handlers) {
        await handlers.write(
          argv.path,
          argv.force,
          (msg) => log.message(msg),
          (msg) => log.error(msg),
        );
      } else {
        const { createMetadataHandlers } = await import("./handlers");
        await createMetadataHandlers().write(
          argv.path,
          argv.force,
          (msg) => log.message(msg),
          (msg) => log.error(msg),
        );
      }
    },
  );
}
