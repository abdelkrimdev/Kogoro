import { log } from "@clack/prompts";
import type { ConfigManager } from "@kogoro/core";
import { PluginRegistry } from "@kogoro/plugins";
import type yargs from "yargs";
import { createFormatter } from "../format";

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
          (argv) => {
            const registry = new PluginRegistry();
            registry.setDisabled(config.getDisabledPlugins());
            const plugins = registry.list();
            const display = createFormatter(!!argv["json"], (msg) => log.error(msg));
            display(JSON.stringify(plugins, null, 2));
          },
        )
        .demandCommand(1, "Please specify a plugins action"),
    () => {},
  );
}
