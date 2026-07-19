import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/adapters/real/userSchema.ts",
  out: "./drizzle/user",
});
