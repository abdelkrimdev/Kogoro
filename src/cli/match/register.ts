import type yargs from "yargs";

export type MatchHandlerFactory = (debug?: boolean) => Promise<
  | {
      match(
        filename: string,
        onLog: (msg: string) => void,
        onError: (msg: string) => void,
      ): Promise<void>;
    }
  | undefined
>;

export function registerMatch(
  parser: ReturnType<typeof yargs>,
  createHandlers: MatchHandlerFactory,
): void {
  parser.command(
    "match <filename>",
    "Parse a MediaFile filename and resolve Match candidates via the Database",
    (yargs) =>
      yargs
        .positional("filename", {
          type: "string",
          demandOption: true,
          describe: "The filename to parse and match",
        })
        .option("debug", {
          type: "boolean",
          default: false,
          describe: "Dump API requests and responses",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv.debug);
      if (!handlers) return;
      await handlers.match(argv.filename, console.log, console.error);
    },
  );
}
