import type { ConfigManager } from "@kogoro/core";
import { PluginRegistry } from "@kogoro/plugins";
import type yargs from "yargs";
import { wrapCommand } from "../wrap";

export function registerPlugins(parser: ReturnType<typeof yargs>, config: ConfigManager): void {
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
            const registry = new PluginRegistry();
            registry.setDisabled(config.getDisabledPlugins());
            await wrapCommand(async () => registry.list());
          },
        )
        .demandCommand(1, "Please specify a plugins action"),
    () => {},
  );
}
