import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 検証対象の宣言がどのファイルに属していても検出できるよう、束ね役の index.css を除く
// 全ファイルを連結して1つの文字列として検査する。
const shellDir = resolve(import.meta.dirname, "../../src/styles/shell");
const shellCss = globSync("*.css", { cwd: shellDir })
  .filter((f) => f !== "index.css")
  .map((f) => readFileSync(resolve(shellDir, f), "utf8"))
  .join("\n");

describe("テキスト選択（TASK-107）", () => {
  it("shell/ 配下のCSSで body 既定と入力要素・選択可能クラスを定義する", () => {
    expect(shellCss).toMatch(/body\s*\{[^}]*user-select:\s*none/s);
    expect(shellCss).toMatch(/input,\s*\n\s*textarea,\s*\n\s*select\s*\{[^}]*user-select:\s*text/s);
    expect(shellCss).toMatch(/\.mll-selectable[^}]*user-select:\s*text/s);
    expect(shellCss).toMatch(/\.mle-prv__warn-path[^}]*user-select:\s*text/s);
    expect(shellCss).toMatch(/\.mle-fprev__path[^}]*user-select:\s*text/s);
  });
});
