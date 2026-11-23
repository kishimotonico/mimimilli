import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("queryFn の規則（ADR-0028）", () => {
  it("すべての queryFn が TanStack Query の signal を受け取って API へ渡す", () => {
    const violations = sourceFiles(SRC).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(/queryFn:/g)]
        .filter((match) => !text.slice(match.index, match.index + 220).includes("signal"))
        .map((match) => `${file}:${text.slice(0, match.index).split("\n").length}`);
    });
    expect(violations).toEqual([]);
  });
});
