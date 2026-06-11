import { homedir } from "node:os";
import { join } from "node:path";
import * as v from "valibot";
import type { EntryType } from "../types";

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

const TemplatePresetSchema = v.picklist([...Object.keys(TEMPLATE_PRESETS), "custom"]);

const EpisodeNumberingSchema = v.picklist(["relative", "absolute"]);

const RenameActionSchema = v.picklist(["move", "copy", "symlink", "hardlink"]);

const SanitizeActionSchema = v.picklist(["strip", "replace"]);

const SanitizeConfigSchema = v.strictObject({
  action: v.optional(SanitizeActionSchema, "strip"),
  replacement: v.optional(v.string(), "_"),
  chars: v.optional(v.string(), '\\/:*?"<>|'),
});

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
  sanitize: v.optional(SanitizeConfigSchema, {
    action: "strip",
    replacement: "_",
    chars: '\\/:*?"<>|',
  }),
});

export const SCHEMA_DEFAULTS = v.getDefaults(ConfigSchema);

export type Config = v.InferOutput<typeof ConfigSchema>;
export type EpisodeNumbering = v.InferOutput<typeof EpisodeNumberingSchema>;
export type RenameAction = v.InferOutput<typeof RenameActionSchema>;
