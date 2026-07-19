import { rmSync } from "node:fs";
import { join } from "node:path";

const artifactRoot = join(import.meta.dir, "..", "artifacts", "sqlite");
const drivers = [
  {
    entrypoint: join(import.meta.dir, "sqlite", "bun-sqlite.ts"),
    name: "bun:sqlite",
    required: true,
  },
  {
    entrypoint: join(import.meta.dir, "sqlite", "better-sqlite3.ts"),
    name: "better-sqlite3",
    required: false,
  },
] as const;

function run(entrypoint: string, phase: "write" | "read", dataDirectory: string): boolean {
  const result = Bun.spawnSync([process.execPath, entrypoint, phase, dataDirectory], {
    cwd: join(import.meta.dir, ".."),
    stderr: "inherit",
    stdout: "inherit",
  });
  return result.exitCode === 0;
}

for (const driver of drivers) {
  const dataDirectory = join(artifactRoot, driver.name.replace(":", "-"));
  rmSync(dataDirectory, { force: true, recursive: true });
  const writePassed = run(driver.entrypoint, "write", dataDirectory);
  const readPassed = writePassed && run(driver.entrypoint, "read", dataDirectory);
  const passed = writePassed && readPassed;
  console.log(`${passed ? "PASS" : "FAIL"} ${driver.name} persistence smoke`);
  if (driver.required && !passed) {
    throw new Error(`required SQLite driver failed: ${driver.name}`);
  }
}

console.log("Required SQLite persistence smoke passed");
