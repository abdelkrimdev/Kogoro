import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { DatabasePlugin } from "./db/database-plugin.ts";
import { Matcher, type MatchResult } from "./matcher.ts";
import { type ParsedResult, parse } from "./parser.ts";

export interface ScanResult {
  file: string;
  parsed: ParsedResult;
  matches: MatchResult[];
}

export interface ScannerOptions {
  database: DatabasePlugin;
}

export class Scanner {
  private db: DatabasePlugin;
  private matcher: Matcher;

  constructor(options: ScannerOptions) {
    this.db = options.database;
    this.matcher = new Matcher({ database: this.db });
  }

  async scanFile(filename: string): Promise<ScanResult> {
    const parsed = parse(filename);
    const matches = await this.matcher.match(parsed);
    return { file: filename, parsed, matches };
  }

  async scanDir(dir: string, extensions: string[]): Promise<ScanResult[]> {
    const files = readdirSync(dir).filter((f) => {
      const fullPath = join(dir, f);
      return statSync(fullPath).isFile() && extensions.includes(extname(f).toLowerCase());
    });
    return Promise.all(files.map((f) => this.scanFile(f)));
  }
}
