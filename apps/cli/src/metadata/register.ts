import type yargs from "yargs";

type MetadataHandlerFactory = (debug?: boolean) => Promise<
  | {
      write(
        path: string,
        cliOptions: { force?: boolean; verbose?: boolean; quiet?: boolean; json?: boolean },
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
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Output summary as JSON",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv["debug"] as boolean | undefined);
      if (!handlers) return;
      await handlers.write(argv.path, {
        force: argv.force,
        json: argv.json,
      });
    },
  );
}
