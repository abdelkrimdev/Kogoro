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
        })
        .option("debug", {
          type: "boolean",
          default: false,
          describe: "Dump API requests and responses",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv.debug);
      if (handlers) {
        await handlers.write(argv.path, argv.force, console.log, console.error);
      } else {
        const { createMetadataHandlers } = await import("./handlers");
        await createMetadataHandlers().write(argv.path, argv.force, console.log, console.error);
      }
    },
  );
}
