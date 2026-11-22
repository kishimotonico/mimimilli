#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLIENT_LAYER_RULES,
  FEATURE_SIBLING_MESSAGE,
  SERVER_LAYER_RULES,
} from "./layer-boundary-rules.mjs";

// テストが本物のツリーを汚さず検査できるよう、検査対象のルートは環境変数で差し替えられる
const repoRoot = process.env.LAYER_BOUNDARY_ROOT
  ? path.resolve(process.env.LAYER_BOUNDARY_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

export function collectImports(source) {
  const imports = [];
  const staticPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(staticPattern)) {
    imports.push(match[1]);
  }
  const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(dynamicPattern)) {
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

  const denyRules = CLIENT_LAYER_RULES.map((rule) => ({
    from: layerRoot(clientSrc, rule.from),
    to: rule.to.map((to) => layerRoot(clientSrc, to)),
    message: rule.message,
  }));

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

      if (!isUnder(resolved, featuresRoot)) {
        continue;
      }

      const targetFeature = path.relative(featuresRoot, resolved).split(path.sep)[0];
      if (featureNames.has(targetFeature) && targetFeature !== sourceFeature) {
        violations.push({
          file,
          specifier,
          message: FEATURE_SIBLING_MESSAGE(sourceFeature, targetFeature),
        });
      }
    }
  }

  return violations;
}

async function checkServerLayerBoundaries() {
  const serverRoot = path.join(repoRoot, "server/src");
  const violations = [];

  const denyRules = SERVER_LAYER_RULES.map((rule) => ({
    fromPrefix: path.join(serverRoot, ...rule.from.split("/")),
    toPrefix: path.join(serverRoot, ...rule.to.split("/")),
    message: rule.message,
  }));

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
