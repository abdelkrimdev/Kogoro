import { homedir } from "node:os";
import { join } from "node:path";
import * as v from "valibot";
import type { EntryType } from "../plugins/database/types";

export const CONFIG_DIR = join(homedir(), ".config", "kogoro");

export const TEMPLATE_PRESETS = {
  standard: "{anime} - {season}x{episode:02} - {title}",
  compact: "{anime} - E{episode:02}",
  absolute: "{anime} - {episode:03}",
  plex: "{anime} - s{season:02}e{episode:02} - {title}",
  anidb: "{anime} - {episode:03} - {title}",
} as const satisfies Record<string, string>;

export const ENTRY_TYPE_DIR_MAP: Record<EntryType, string> = {
  tv: "TV",
  movie: "Movies",
  ova: "OVA",
  special: "Specials",
};

export const ORGANIZED_DIRS = new Set(Object.values(ENTRY_TYPE_DIR_MAP));

const TemplatePresetSchema = v.picklist(Object.keys(TEMPLATE_PRESETS) as [string, ...string[]]);

const EpisodeNumberingSchema = v.picklist(["relative", "absolute"]);

const RenameActionSchema = v.picklist(["move", "copy", "symlink", "hardlink"]);

const TemplateConfigSchema = v.strictObject({
  preset: v.optional(TemplatePresetSchema, "standard"),
  custom: v.optional(v.string(), ""),
  directory: v.optional(v.string(), "{anime}/{type}"),
});

const PluginToggleSchema = v.strictObject({
  enabled: v.optional(v.boolean(), true),
});

const PluginsConfigSchema = v.strictObject({
  tvdb: PluginToggleSchema,
  anidb: PluginToggleSchema,
  opensubtitles: PluginToggleSchema,
});

export const ConfigSchema = v.strictObject({
  "primary-db": v.optional(v.string(), "tvdb"),
  "secondary-dbs": v.optional(v.string(), ""),
  template: v.optional(TemplateConfigSchema, {
    preset: "standard",
    custom: "",
    directory: "{anime}/{type}",
  }),
  "media-extensions": v.optional(v.array(v.string()), [
    ".mkv",
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".ogm",
    ".m4v",
  ]),
  "exclude-patterns": v.optional(v.array(v.string()), [".part", ".crdownload", "!qb"]),
  "scan-concurrency": v.optional(v.number(), 4),
  "fetch-concurrency": v.optional(v.number(), 5),
  "episode-numbering": v.optional(EpisodeNumberingSchema, "relative"),
  "rename-action": v.optional(RenameActionSchema, "move"),
  "subtitle-language": v.optional(v.string(), "en"),
  plugins: v.optional(PluginsConfigSchema, {
    tvdb: { enabled: true },
    anidb: { enabled: true },
    opensubtitles: { enabled: true },
  }),
});

export type Config = v.InferOutput<typeof ConfigSchema>;
export type TemplatePreset = v.InferOutput<typeof TemplatePresetSchema>;
export type EpisodeNumbering = v.InferOutput<typeof EpisodeNumberingSchema>;
export type RenameAction = v.InferOutput<typeof RenameActionSchema>;

const CONFIG_DEFAULTS = v.parse(ConfigSchema, {});
export const DEFAULT_MEDIA_EXTENSIONS = CONFIG_DEFAULTS["media-extensions"];
export const DEFAULT_EXCLUDE_PATTERNS = CONFIG_DEFAULTS["exclude-patterns"];
export const DEFAULT_SCAN_CONCURRENCY = CONFIG_DEFAULTS["scan-concurrency"];
export const DEFAULT_SUBTITLE_LANGUAGE = CONFIG_DEFAULTS["subtitle-language"];
export const DEFAULT_DIRECTORY_TEMPLATE = CONFIG_DEFAULTS.template.directory;
