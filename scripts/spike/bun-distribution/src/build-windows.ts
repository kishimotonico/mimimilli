import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outputDirectory = join(root, "artifacts", "windows-x64");
rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const builds = [
  {
    entrypoint: join(import.meta.dir, "compiled-server.ts"),
    name: "mimimilli-bun-sqlite.exe",
    required: true,
  },
  {
    entrypoint: join(import.meta.dir, "probes", "hono-node-server.ts"),
    name: "probe-hono-node-server.exe",
    required: false,
  },
  {
    entrypoint: join(import.meta.dir, "probes", "better-sqlite3-compile.ts"),
    name: "probe-better-sqlite3.exe",
    required: false,
  },
  {
    entrypoint: join(import.meta.dir, "probes", "sharp.ts"),
    name: "probe-sharp.exe",
    required: false,
  },
] as const;

let requiredBuildFailed = false;
for (const build of builds) {
  const output = join(outputDirectory, build.name);
  const result = Bun.spawnSync([
    process.execPath,
    "build",
    "--compile",
    "--target=bun-windows-x64",
    "--outfile",
    output,
    build.entrypoint,
  ]);
  const stderr = result.stderr.toString().trim();
  const status = result.exitCode === 0 ? "PASS" : "FAIL";
  console.log(`${status} ${build.name}`);
  if (stderr) {
    console.log(stderr);
  }
  if (build.required && result.exitCode !== 0) {
    requiredBuildFailed = true;
  }
}

if (requiredBuildFailed) {
  throw new Error("required Windows executable build failed");
}
