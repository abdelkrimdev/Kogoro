import type { DatabasePlugin } from "../db/database-plugin.ts";
import { Matcher } from "../matcher.ts";
import { parse } from "../parser.ts";

export interface MatchHandlerOptions {
  database: DatabasePlugin;
}

export function createMatchHandlers(options: MatchHandlerOptions) {
  const matcher = new Matcher({ database: options.database });

  return {
    async match(
      filename: string,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const parsed = parse(filename);
        const results = await matcher.match(parsed);
        onLog(JSON.stringify(results, null, 2));
      } catch {
        onError("Match failed");
      }
    },
  };
}
