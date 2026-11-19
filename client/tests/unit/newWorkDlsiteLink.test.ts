import { describe, expect, it } from "vitest";
import { newWorkDlsiteLink } from "../../src/features/scan/model/newWorkDlsiteLink";

describe("newWorkDlsiteLink", () => {
  it.each([
    [{ rjCode: null, status: "none" }, null],
    [{ rjCode: "", status: "none" }, null],
    [{ rjCode: "RJ1", status: "applied" }, "linked"],
    [{ rjCode: "RJ1", status: "none" }, "unlinked"],
    [{ rjCode: "RJ1", status: "not_found" }, "unlinked"],
    [{ rjCode: "RJ1", status: "error" }, "unlinked"],
    [{ rjCode: "RJ1", status: "skipped" }, "unlinked"],
  ] as const)("%j は %s", (dlsite, expected) => {
    expect(newWorkDlsiteLink({ ...dlsite })).toBe(expected);
  });
});
