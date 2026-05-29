export { AniDBPlugin } from "./database/anidb-plugin";
export type { DatabasePlugin } from "./database/plugin";
export { TVDBPlugin } from "./database/tvdb-plugin";
export type {
  AnimeResult,
  ArtworkResult,
  ArtworkType,
  EntryType,
  EpisodeResult,
} from "./database/types";
export { PluginFactory } from "./plugin-factory";
export type { PluginInfo } from "./plugin-registry";
export { isDatabasePlugin, isSubtitlePlugin, PluginRegistry } from "./plugin-registry";
export { OpenSubtitlesPlugin } from "./subtitle/opensubtitles-plugin";
export type { SubtitlePlugin } from "./subtitle/plugin";
export type { SubtitleResult } from "./subtitle/types";
