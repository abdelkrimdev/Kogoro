import type yargs from "yargs";
import { parse } from "../../parser";

export function registerParse(parser: ReturnType<typeof yargs>): void {
  parser.command(
    "parse <filename>",
    "Parse a MediaFile filename and print the ParsedResult as JSON",
    (yargs) =>
      yargs.positional("filename", {
        type: "string",
        demandOption: true,
        describe: "The filename to parse",
      }),
    (argv) => {
      const result = parse(argv.filename);
      console.log(JSON.stringify(result, null, 2));
    },
  );
}
