import { describe, expect, it } from "vitest";
import { FILE_SYSTEM_QUERY_KEYS } from "../../src/entities/file-system/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/entities/scan/queryKeys";

describe("query key factories", () => {
  it("FILE_SYSTEM_QUERY_KEYS.all は fs プレフィックス全体を指す", () => {
    expect(FILE_SYSTEM_QUERY_KEYS.all()).toEqual(["fs"]);
    expect(FILE_SYSTEM_QUERY_KEYS.directory("works/foo")).toEqual(["fs", "works/foo"]);
  });

  it("SCAN_QUERY_KEYS.diagnostics は scan diagnostics を指す", () => {
    expect(SCAN_QUERY_KEYS.diagnostics()).toEqual(["scan", "diagnostics"]);
  });
});
