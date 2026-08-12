import { describe, expect, it } from "vitest";
import {
  WORK_SOURCE_PATCH_BLOCKED_MESSAGE,
  assertWorkSourceRevision,
  canPatchWorkSource,
} from "../../src/entities/work/sourceRevision";

describe("sourceRevision", () => {
  it("canPatchWorkSource は未設定を false、非空文字列を true とする", () => {
    expect(canPatchWorkSource(undefined)).toBe(false);
    expect(canPatchWorkSource("")).toBe(false);
    expect(canPatchWorkSource("revision-1")).toBe(true);
  });

  it("assertWorkSourceRevision は未設定時に統一メッセージで throw する", () => {
    expect(() => assertWorkSourceRevision(undefined)).toThrow(WORK_SOURCE_PATCH_BLOCKED_MESSAGE);
    expect(assertWorkSourceRevision("revision-1")).toBe("revision-1");
  });
});
