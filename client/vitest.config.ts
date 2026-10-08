import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    pool: "threads",
    globals: true,
    include: ["tests/unit/**/*.test.ts?(x)"],
    setupFiles: "./tests/unit/setup.ts",
  },
});
