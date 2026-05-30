import type { ConfigManager } from "@kogoro/core";
import { PluginRegistry } from "@kogoro/plugins";
import type yargs from "yargs";

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
          () => {
            const registry = new PluginRegistry();
            registry.setDisabled(config.getDisabledPlugins());
            const plugins = registry.list();
            console.log(JSON.stringify(plugins));
          },
        )
        .demandCommand(1, "Please specify a plugins action"),
    () => {},
  );
}
