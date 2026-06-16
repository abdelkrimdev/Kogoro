import { extract } from "./extract";
import { preprocess } from "./preprocess";
import { resolve } from "./resolve";

export interface ParsedTags {
  group: string | null;
  resolution: string | null;
  source: string | null;
  codec: string | null;
  audio: string | null;
}

export interface ParsedResult {
  title: string | null;
  season: number | null;
  episode: number | null;
  tags: ParsedTags;
}

export { stripExtension } from "./preprocess";
export { createEmptyResult } from "./resolve";

export function parse(filename: string, extensions?: readonly string[]): ParsedResult {
  const { name } = preprocess(filename, extensions);
  const { tags, cleanName } = extract(name);
  return resolve(filename, cleanName, tags);
}
