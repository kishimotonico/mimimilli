import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectImports } from "./check-layer-boundaries.mjs";
import {
  buildOxlintLayerOverrides,
  isGeneratedLayerOverride,
  listFeatureNames,
} from "./layer-boundary-rules.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const boundaryScript = path.join(scriptDir, "check-layer-boundaries.mjs");
const oxlintrcPath = path.join(repoRoot, ".oxlintrc.json");

function runBoundaryCheck(root = repoRoot) {
  return spawnSync(process.execPath, [boundaryScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LAYER_BOUNDARY_ROOT: root },
  });
}

function runOxlint(targets) {
  return spawnSync("pnpm", ["exec", "oxlint", "-c", oxlintrcPath, "--format", "unix", ...targets], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

const RULE_PROBES = [
  {
    name: "shared → features",
    file: "client/src/shared/__boundary_probe__.ts",
    source: 'export const load = () => import("../features/library/ui/LibraryView");\n',
    oxlintSource: 'export { default } from "../features/library/ui/LibraryView";\n',
    message: "shared から entities/features/app への import は禁止",
  },
  {
    name: "entities → features",
    file: "client/src/entities/__boundary_probe__.ts",
    source: 'export { default } from "../features/library/ui/LibraryView";\n',
    message: "entities から features/app への import は禁止",
  },
  {
    name: "features → app",
    file: "client/src/features/library/__boundary_probe__.ts",
    source: 'export { default } from "../../app/App";\n',
    message: "features から app への import は禁止",
  },
  {
    name: "features sibling",
    file: "client/src/features/library/__boundary_probe_sibling__.ts",
    source: 'export { default } from "../player/ui/PlayerDock";\n',
    message: "features/library から features/player への sibling import は禁止",
  },
  {
    name: "routes → adapters",
    file: "server/src/routes/__boundary_probe__.ts",
    source: 'export { CatalogWorkRepository } from "../adapters/real/catalogWorkRepository.ts";\n',
    message: "routes から adapters への直接 import は禁止",
  },
  {
    name: "adapters → routes",
    file: "server/src/adapters/__boundary_probe__.ts",
    source: 'export { worksRoute } from "../routes/works.ts";\n',
    message: "adapters から routes への import は禁止",
  },
  {
    name: "core → adapters",
    file: "server/src/core/__boundary_probe__.ts",
    source: 'export { Scanner } from "../adapters/real/scanner.ts";\n',
    message: "core から adapters への import は禁止",
  },
  {
    name: "core → routes",
    file: "server/src/core/__boundary_probe_routes__.ts",
    source: 'export { worksRoute } from "../routes/works.ts";\n',
    message: "core から routes への import は禁止",
  },
  {
    name: "fixture → real",
    file: "server/src/adapters/fixture/__boundary_probe__.ts",
    source: 'export { Scanner } from "../real/scanner.ts";\n',
    message: "adapters/fixture から adapters/real への import は禁止",
  },
  {
    name: "real → fixture",
    file: "server/src/adapters/real/__boundary_probe__.ts",
    source: 'export { createFixtureAdapter } from "../fixture/index.ts";\n',
    message: "adapters/real から adapters/fixture への import は禁止",
  },
];

// 本物のソースツリーには書かず、一時ディレクトリに規則の対象になるディレクトリだけを作ってプローブを置く
const PROBE_SKELETON_DIRS = [
  "client/src/app",
  "client/src/features/library",
  "client/src/features/player",
];

async function withProbes(selectSource, fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "layer-boundary-"));
  try {
    for (const dir of PROBE_SKELETON_DIRS) {
      await mkdir(path.join(root, dir), { recursive: true });
    }
    const written = [];
    for (const probe of RULE_PROBES) {
      const probeFile = path.join(root, probe.file);
      await mkdir(path.dirname(probeFile), { recursive: true });
      await writeFile(probeFile, selectSource(probe), "utf8");
      written.push(probeFile);
    }
    await fn(written, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("collectImports collects dynamic import string literals", () => {
  const source = `const View = lazy(() => import("../features/files/ui/FilesView"));`;
  assert.deepEqual(collectImports(source), ["../features/files/ui/FilesView"]);
});

test("collectImports collects static and dynamic imports", () => {
  const source = `
    import { x } from "./a";
    const m = () => import("./b");
  `;
  assert.deepEqual(collectImports(source), ["./a", "./b"]);
});

test("collectImports collects TypeScript import type expressions without affecting boundary checks", () => {
  const source = `type X = import("@mimimilli/shared").TagFilters;`;
  assert.deepEqual(collectImports(source), ["@mimimilli/shared"]);
});

test("oxlint のレイヤー overrides は layer-boundary-rules から導出される", async () => {
  const config = JSON.parse(await readFile(oxlintrcPath, "utf8"));
  const featureNames = await listFeatureNames(repoRoot);
  const expected = buildOxlintLayerOverrides(featureNames);
  const actual = (config.overrides ?? []).filter(isGeneratedLayerOverride);
  assert.deepEqual(actual, expected);
  assert.ok(
    (config.overrides ?? []).some((override) => override.files?.includes("**/App.tsx")),
    "App.tsx 固有の制限は手書きのまま残る",
  );
});

test("境界スクリプトが各レイヤー規則の意図的な違反を検知する", async () => {
  await withProbes(
    (probe) => probe.source,
    async (_written, root) => {
      const result = runBoundaryCheck(root);
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      for (const probe of RULE_PROBES) {
        assert.match(result.stderr, new RegExp(probe.message.replaceAll("/", "\\/")), probe.name);
      }
    },
  );
});

test("oxlint が各レイヤー規則の意図的な違反を検知する", async () => {
  await withProbes(
    (probe) => probe.oxlintSource ?? probe.source,
    async (written) => {
      const result = runOxlint(written);
      const output = `${result.stdout}\n${result.stderr}`;
      assert.notEqual(result.status, 0, output);
      for (const probe of RULE_PROBES) {
        assert.match(output, new RegExp(`${probe.file.replaceAll(".", "\\.")}:`), probe.name);
      }
      assert.match(output, /no-restricted-imports/);
    },
  );
});

test("check-layer-boundaries passes on the current repository", () => {
  const result = runBoundaryCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /layer boundaries: ok/);
});
