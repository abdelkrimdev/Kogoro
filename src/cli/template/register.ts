import type yargs from "yargs";
import { render } from "../../template-engine";

export function registerTemplate(
  parser: ReturnType<typeof yargs>,
  result: { value: string | undefined },
): void {
  parser.command(
    "template <pattern>",
    "Test a rename pattern with {placeholder} variables",
    (yargs) =>
      yargs
        .strict(false)
        .positional("pattern", {
          type: "string",
          demandOption: true,
          describe: "Template pattern with {placeholder} variables",
        })
        .option("anime", { type: "string", describe: "Anime title" })
        .option("season", { type: "number", describe: "Season number" })
        .option("episode", { type: "number", describe: "Episode number" })
        .option("title", { type: "string", describe: "Episode title" }),
    (argv) => {
      const ctx: Record<string, string | number> = {};
      const reservedKeys = new Set(["_", "$0", "pattern", "help", "version"]);
      for (const [key, value] of Object.entries(argv)) {
        if (!reservedKeys.has(key) && value !== undefined) {
          ctx[key] = value as string | number;
        }
      }
      result.value = render(argv.pattern, ctx);
    },
  );
}
