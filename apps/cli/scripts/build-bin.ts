import { spawnSync } from "node:child_process";

const target = process.env["TARGET"];
const outfile = process.env["OUTFILE"] ?? "kogoro";

const args = ["build", "--compile"];
if (target) args.push("--target", target);
args.push("src/index.ts", "--outfile", `dist/${outfile}`);

const result = spawnSync("bun", args, { stdio: "inherit", cwd: `${import.meta.dirname}/..` });
process.exit(result.status ?? 1);
