import { describe, expect, it } from "vitest";
import { workspacePath } from "@mimimilli/shared";
import {
  describeWorkChange,
  describeWorkChanges,
} from "../../src/features/scan/model/describeWorkChange";

describe("describeWorkChange", () => {
  it("移動は旧パス → 新パスを補足に持つ", () => {
    const description = describeWorkChange({
      kind: "moved",
      from: workspacePath("旧/RJ1"),
      to: workspacePath("RJ1"),
    });
    expect(description).toMatchObject({
      label: "移動",
      detail: "旧/RJ1 → RJ1",
      title: "旧/RJ1 → RJ1",
    });
  });

  it("作品情報ファイルの更新", () => {
    expect(describeWorkChange({ kind: "meta" }).label).toBe("作品情報ファイルを更新");
  });

  it.each([
    [3, "音声ファイル +3"],
    [-2, "音声ファイル −2"],
    [0, "ファイル構成を更新"],
  ])("filesのaudioDelta %i は「%s」", (audioDelta, label) => {
    expect(describeWorkChange({ kind: "files", audioDelta }).label).toBe(label);
  });

  it("並びは移動・作品情報・ファイル構成の順", () => {
    const labels = describeWorkChanges([
      { kind: "files", audioDelta: 1 },
      { kind: "meta" },
      { kind: "moved", from: workspacePath("a"), to: workspacePath("b") },
    ]).map((change) => change.kind);
    expect(labels).toEqual(["moved", "meta", "files"]);
  });
});
