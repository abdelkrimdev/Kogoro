import type { ConfigManager, CredentialStore } from "@kogoro/core";
import { PluginFactory } from "@kogoro/plugins";
import type yargs from "yargs";
import { wrapCommand } from "../wrap";

export function registerPlugins(
  parser: ReturnType<typeof yargs>,
  config: ConfigManager,
  credentialStore: CredentialStore,
): void {
  parser.command(
    "plugins",
    "List all discovered plugins (built-in + external)",
    (yargs) =>
      yargs
        .command(
          "list",
          "List all plugins",
          () => {},
          async () => {
            const factory = new PluginFactory(config, credentialStore);
            await wrapCommand(async () => factory.list());
          },
        )
        .demandCommand(1, "Please specify a plugins action"),
    () => {},
  );
}
