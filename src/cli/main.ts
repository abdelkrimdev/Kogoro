import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ConfigManager } from "../config/config-manager";
import { createCredentialStore } from "../config/credential-store";
import { MatchCache } from "../match-cache";
import type { NumberingScheme } from "../numbering-converter";
import { OverrideStore } from "../override-store";
import { PluginFactory } from "../plugin-factory";
import type { DatabasePlugin } from "../plugins/database/plugin";
import { registerArtwork } from "./artwork/register";
import { registerCache } from "./cache/register";
import { registerConfig } from "./config/register";
import { registerDb } from "./database/register";
import { registerMatch } from "./match/register";
import { registerMetadata } from "./metadata/register";
import { registerParse } from "./parse/register";
import { registerPlugins } from "./plugins/register";
import { registerRename } from "./rename/register";
import { registerScan } from "./scan/register";
import { registerSubtitle } from "./subtitle/register";
import { registerTemplate } from "./template/register";

export function run(argv: string[]): string | undefined {
  const config = new ConfigManager();
  const credentialStore = createCredentialStore();

  function createFactory(debug?: boolean): PluginFactory {
    return new PluginFactory(config, credentialStore, debug);
  }

  async function withDatabase<T>(
    debug: boolean | undefined,
    getDatabase: (factory: PluginFactory) => Promise<DatabasePlugin | undefined>,
    buildHandlers: (database: DatabasePlugin) => T,
  ): Promise<T | undefined> {
    const factory = createFactory(debug);
    const database = await getDatabase(factory);
    if (!database) return undefined;
    return buildHandlers(database);
  }

  async function createDatabaseCommandsWithCredentials(name: string, debug?: boolean) {
    const { createDatabaseCommands } = await import("./database/handlers");
    return withDatabase(
      debug,
      (factory) => factory.database(name),
      (database) => createDatabaseCommands(database),
    );
  }

  async function createScanWithCredentials(episodeNumbering?: NumberingScheme, debug?: boolean) {
    const { createScanHandlers } = await import("./scan/handlers");
    const factory = createFactory(debug);
    const database = await factory.primaryDatabase();
    if (!database) return undefined;
    const fallbackDatabases = await factory.secondaryDatabases();
    const cache = new MatchCache();
    const overrideStore = new OverrideStore(process.cwd());
    return createScanHandlers({
      database,
      fallbackDatabases,
      cache,
      config,
      episodeNumbering,
      overrideStore,
    });
  }

  async function createMatchWithCredentials(debug?: boolean) {
    const { createMatchHandlers } = await import("./match/handlers");
    return withDatabase(
      debug,
      (factory) => factory.primaryDatabase(),
      (database) => createMatchHandlers({ database }),
    );
  }

  async function createMetadataWithCredentials(debug?: boolean) {
    const { createMetadataHandlers } = await import("./metadata/handlers");
    return withDatabase(
      debug,
      (factory) => factory.primaryDatabase(),
      (database) => createMetadataHandlers({ database }),
    );
  }

  async function createArtworkWithCredentials(debug?: boolean) {
    const { createArtworkHandlers } = await import("./artwork/handlers");
    const factory = createFactory(debug);
    const database = await factory.primaryDatabase();
    if (!database) return undefined;
    const fallbackDatabases = await factory.secondaryDatabases();
    return createArtworkHandlers({ primaryDb: database, secondaryDbs: fallbackDatabases });
  }

  async function createSubtitleWithCredentials(debug?: boolean) {
    const { createSubtitleHandlers } = await import("./subtitle/handlers");
    const factory = createFactory(debug);
    const subtitlePlugin = await factory.subtitle();
    if (!subtitlePlugin) return undefined;
    const cache = new MatchCache();
    return createSubtitleHandlers({ subtitlePlugin, cache });
  }

  const templateResult = { value: undefined as string | undefined };

  const parser = yargs(hideBin(argv)).scriptName("kogoro").usage("$0 <command> [options]");

  registerScan(parser, createScanWithCredentials);
  registerArtwork(parser, createArtworkWithCredentials);
  registerSubtitle(parser, createSubtitleWithCredentials);
  registerMetadata(parser, createMetadataWithCredentials);
  registerParse(parser);
  registerConfig(parser);
  registerDb(parser, createDatabaseCommandsWithCredentials);
  registerMatch(parser, createMatchWithCredentials);
  registerCache(parser);
  registerRename(parser);
  registerTemplate(parser, templateResult);
  registerPlugins(parser, config);

  parser
    .demandCommand(1, "Please specify a command")
    .help()
    .alias("h", "help")
    .version("0.1.0")
    .alias("v", "version")
    .strict()
    .parse();

  return templateResult.value;
}
