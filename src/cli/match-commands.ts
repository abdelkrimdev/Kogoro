import { Matcher } from "../matcher";
import { parse } from "../parser";
import type { DatabasePlugin } from "../plugins/database/plugin";

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
