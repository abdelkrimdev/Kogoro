import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/library/schema.ts", "./src/match/schema.ts"],
  out: "./drizzle",
});
