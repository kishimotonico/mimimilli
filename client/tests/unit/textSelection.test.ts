import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shellCss = readFileSync(resolve(import.meta.dirname, "../../src/styles/shell.css"), "utf8");

describe("テキスト選択（TASK-107）", () => {
  it("shell.css で body 既定と入力要素・選択可能クラスを定義する", () => {
    expect(shellCss).toMatch(/body\s*\{[^}]*user-select:\s*none/s);
    expect(shellCss).toMatch(/input,\s*\n\s*textarea,\s*\n\s*select\s*\{[^}]*user-select:\s*text/s);
    expect(shellCss).toMatch(/\.mll-selectable[^}]*user-select:\s*text/s);
    expect(shellCss).toMatch(/\.mle-prv__warn-path[^}]*user-select:\s*text/s);
    expect(shellCss).toMatch(/\.mle-fprev__path[^}]*user-select:\s*text/s);
  });
});
