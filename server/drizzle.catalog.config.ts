import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/adapters/real/catalogSchema.ts",
  out: "./drizzle/catalog",
});
