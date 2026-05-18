import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { DatabasePlugin } from "./db/database-plugin.ts";
import { Matcher, type MatchResult } from "./matcher.ts";
import type { OverrideStore } from "./override-store.ts";
import { type ParsedResult, parse } from "./parser.ts";

export interface ScanResult {
  file: string;
  parsed: ParsedResult;
  matches: MatchResult[];
  fileHash?: string;
}

export interface ScannerOptions {
  database: DatabasePlugin;
  overrideStore?: OverrideStore;
}

function computeFileHash(filePath: string): string {
  return Bun.hash(filePath).toString(16);
}

export class Scanner {
  private db: DatabasePlugin;
  private matcher: Matcher;

  constructor(options: ScannerOptions) {
    this.db = options.database;
    this.matcher = new Matcher({ database: this.db, overrideStore: options.overrideStore });
  }

  async scanFile(filename: string): Promise<ScanResult> {
    const parsed = parse(filename);
    const fileHash = computeFileHash(filename);
    const matches = await this.matcher.match(parsed, fileHash);
    return { file: filename, parsed, matches, fileHash };
  }

  async scanDir(dir: string, extensions: string[]): Promise<ScanResult[]> {
    const files = readdirSync(dir).filter((f) => {
      const fullPath = join(dir, f);
      return statSync(fullPath).isFile() && extensions.includes(extname(f).toLowerCase());
    });
    return Promise.all(files.map((f) => this.scanFile(f)));
  }
}
