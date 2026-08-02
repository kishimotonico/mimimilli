import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outputDirectory = join(root, "artifacts", "windows-x64");
rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const output = join(outputDirectory, "logtape-spike.exe");
const entrypoint = join(import.meta.dir, "spike.ts");

const result = Bun.spawnSync([
  process.execPath,
  "build",
  "--compile",
  "--target=bun-windows-x64",
  "--outfile",
  output,
  entrypoint,
]);

const stderr = result.stderr.toString().trim();
const status = result.exitCode === 0 ? "PASS" : "FAIL";
console.log(`${status} ${output}`);
if (stderr) {
  console.log(stderr);
}

if (result.exitCode !== 0) {
  throw new Error("Windows executable build failed");
}
