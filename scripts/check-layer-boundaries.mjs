#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = new Set([".ts", ".tsx"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectImports(source) {
  const imports = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  return path.resolve(path.dirname(fromFile), specifier);
}

function formatViolation({ file, message, specifier }) {
  const relativeFile = path.relative(repoRoot, file);
  return `${relativeFile}: ${message} (${specifier})`;
}

function layerRoot(clientSrc, layer) {
  return path.join(clientSrc, layer);
}

function isUnder(filePath, rootPath) {
  return filePath === rootPath || filePath.startsWith(rootPath + path.sep);
}

async function checkClientLayerBoundaries() {
  const clientSrc = path.join(repoRoot, "client/src");
  const violations = [];

  const denyRules = [
    {
      from: layerRoot(clientSrc, "shared"),
      to: [
        layerRoot(clientSrc, "entities"),
        layerRoot(clientSrc, "features"),
        layerRoot(clientSrc, "app"),
      ],
      message: "shared から entities/features/app への import は禁止",
    },
    {
      from: layerRoot(clientSrc, "entities"),
      to: [layerRoot(clientSrc, "features"), layerRoot(clientSrc, "app")],
      message: "entities から features/app への import は禁止",
    },
  ];

  for (const file of await walk(clientSrc)) {
    const source = await readFile(file, "utf8");
    for (const specifier of collectImports(source)) {
      const resolved = resolveImport(file, specifier);
      if (!resolved) {
        continue;
      }

      for (const rule of denyRules) {
        if (!isUnder(file, rule.from)) {
          continue;
        }
        for (const toPrefix of rule.to) {
          if (isUnder(resolved, toPrefix)) {
            violations.push({ file, specifier, message: rule.message });
          }
        }
      }
    }
  }

  return violations;
}

async function checkClientFeatureBoundaries() {
  const featuresRoot = path.join(repoRoot, "client/src/features");
  const featureNames = new Set(
    (await readdir(featuresRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const violations = [];

  for (const file of await walk(featuresRoot)) {
    const sourceFeature = path.relative(featuresRoot, file).split(path.sep)[0];
    const source = await readFile(file, "utf8");

    for (const specifier of collectImports(source)) {
      const resolved = resolveImport(file, specifier);
      if (!resolved) {
        continue;
      }

      const appRoot = path.join(repoRoot, "client/src/app");
      if (isUnder(resolved, appRoot)) {
        violations.push({
          file,
          specifier,
          message: "features から app への import は禁止",
        });
        continue;
      }

      if (!isUnder(resolved, featuresRoot)) {
        continue;
      }

      const targetFeature = path.relative(featuresRoot, resolved).split(path.sep)[0];
      if (featureNames.has(targetFeature) && targetFeature !== sourceFeature) {
        violations.push({
          file,
          specifier,
          message: `features/${sourceFeature} から features/${targetFeature} への sibling import は禁止`,
        });
      }
    }
  }

  return violations;
}

async function checkServerLayerBoundaries() {
  const serverRoot = path.join(repoRoot, "server/src");
  const violations = [];

  const denyRules = [
    {
      fromPrefix: path.join(serverRoot, "routes"),
      toPrefix: path.join(serverRoot, "adapters"),
      message: "routes から adapters への直接 import は禁止",
    },
    {
      fromPrefix: path.join(serverRoot, "adapters"),
      toPrefix: path.join(serverRoot, "routes"),
      message: "adapters から routes への import は禁止",
    },
    {
      fromPrefix: path.join(serverRoot, "core"),
      toPrefix: path.join(serverRoot, "routes"),
      message: "core から routes への import は禁止",
    },
    {
      fromPrefix: path.join(serverRoot, "core"),
      toPrefix: path.join(serverRoot, "adapters"),
      message: "core から adapters への import は禁止",
    },
    {
      fromPrefix: path.join(serverRoot, "adapters", "fixture"),
      toPrefix: path.join(serverRoot, "adapters", "real"),
      message: "adapters/fixture から adapters/real への import は禁止",
    },
    {
      fromPrefix: path.join(serverRoot, "adapters", "real"),
      toPrefix: path.join(serverRoot, "adapters", "fixture"),
      message: "adapters/real から adapters/fixture への import は禁止",
    },
  ];

  for (const file of await walk(serverRoot)) {
    const source = await readFile(file, "utf8");
    for (const specifier of collectImports(source)) {
      const resolved = resolveImport(file, specifier);
      if (!resolved) {
        continue;
      }

      for (const rule of denyRules) {
        if (!file.startsWith(rule.fromPrefix + path.sep) && file !== rule.fromPrefix) {
          continue;
        }
        if (resolved.startsWith(rule.toPrefix + path.sep) || resolved === rule.toPrefix) {
          violations.push({
            file,
            specifier,
            message: rule.message,
          });
        }
      }
    }
  }

  return violations;
}

async function main() {
  const violations = [
    ...(await checkClientLayerBoundaries()),
    ...(await checkClientFeatureBoundaries()),
    ...(await checkServerLayerBoundaries()),
  ];

  if (violations.length === 0) {
    console.log("layer boundaries: ok");
    return;
  }

  console.error("layer boundary violations:");
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`);
  }
  process.exitCode = 1;
}

await main();
