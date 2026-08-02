import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outputDirectory = join(root, "artifacts");
mkdirSync(outputDirectory, { recursive: true });

const output = join(outputDirectory, "spike-bin");
const entrypoint = join(import.meta.dir, "spike.ts");

const result = Bun.spawnSync([
  process.execPath,
  "build",
  "--compile",
  "--outfile",
  output,
  entrypoint,
]);

const stderr = result.stderr.toString().trim();
if (result.exitCode !== 0) {
  if (stderr) {
    console.error(stderr);
  }
  throw new Error("local compile failed");
}

console.log(`PASS ${output}`);
if (stderr) {
  console.log(stderr);
}
