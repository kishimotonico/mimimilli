import { describe, expect, it } from "vitest";
import { getWorkFolderDisplay } from "../../src/features/files/model/workFolderDisplay";

describe("getWorkFolderDisplay", () => {
  it("moves an RJ code to the badge and removes an underscore-separated prefix", () => {
    expect(getWorkFolderDisplay("RJ501003_幼馴染と過ごす雨の日", "RJ501003")).toEqual({
      badge: "RJ501003",
      name: "幼馴染と過ごす雨の日",
    });
  });

  it("removes a whitespace-separated RJ prefix", () => {
    expect(getWorkFolderDisplay("RJ501003 幼馴染と過ごす雨の日", "RJ501003")).toEqual({
      badge: "RJ501003",
      name: "幼馴染と過ごす雨の日",
    });
  });

  it("keeps the folder name when it does not start with the matching RJ code", () => {
    expect(getWorkFolderDisplay("幼馴染と過ごす雨の日", "RJ501003")).toEqual({
      badge: "RJ501003",
      name: "幼馴染と過ごす雨の日",
    });
  });

  it("uses the generic work badge for a code-only folder name", () => {
    expect(getWorkFolderDisplay("RJ501003", "RJ501003")).toEqual({
      badge: "作品",
      name: "RJ501003",
    });
  });

  it("uses the generic work badge when an RJ prefix has no title separator", () => {
    expect(getWorkFolderDisplay("RJ501003幼馴染と過ごす雨の日", "RJ501003")).toEqual({
      badge: "作品",
      name: "RJ501003幼馴染と過ごす雨の日",
    });
  });

  it("keeps the existing work badge and name for a non-RJ work id", () => {
    expect(getWorkFolderDisplay("自主制作_雨の日", "WORK-001")).toEqual({
      badge: "作品",
      name: "自主制作_雨の日",
    });
  });

  it("does not add a badge when the entry is not a registered work folder", () => {
    expect(getWorkFolderDisplay("未登録フォルダー", null)).toEqual({
      badge: null,
      name: "未登録フォルダー",
    });
  });
});
