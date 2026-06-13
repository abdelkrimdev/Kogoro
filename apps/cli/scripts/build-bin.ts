import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const target = process.env["TARGET"];
const outfile = process.env["OUTFILE"] ?? "kogoro";

const workspaceRoot = resolve(import.meta.dirname, "../../..");

spawnSync("bun", ["run", "apps/cli/scripts/embed-migrations.ts"], {
  stdio: "inherit",
  cwd: workspaceRoot,
});

const args = ["build", "--compile"];
if (target) args.push("--target", target);
args.push("src/index.ts", "--outfile", `dist/${outfile}`);

const result = spawnSync("bun", args, { stdio: "inherit", cwd: `${import.meta.dirname}/..` });
process.exit(result.status ?? 1);
