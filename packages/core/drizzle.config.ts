import { defineConfig } from "drizzle-kit";

export default defineConfig({
  strict: true,
  verbose: true,
  breakpoints: true,
  dialect: "sqlite",
  schema: ["./src/library/schema.ts", "./src/match/schema.ts"],
  out: "./drizzle",
});
