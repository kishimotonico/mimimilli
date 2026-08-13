import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDlsiteState } from "@mimimilli/shared";
import {
  projectDlsiteState,
  shouldRefreshDlsiteProjectionAfterFetch,
  sidecarLinkageStatus,
  toSidecarDlsiteState,
} from "../src/adapters/real/dlsiteProjection.ts";
import { nts } from "./helpers/tag.ts";

test("sidecarLinkageStatus: 取得失敗は none として扱う", () => {
  assert.equal(sidecarLinkageStatus("none"), "none");
  assert.equal(sidecarLinkageStatus("applied"), "applied");
  assert.equal(sidecarLinkageStatus("skipped"), "skipped");
  assert.equal(sidecarLinkageStatus("not_found"), "none");
  assert.equal(sidecarLinkageStatus("error"), "none");
});

test("toSidecarDlsiteState: 一時状態フィールドを落とす", () => {
  assert.deepEqual(
    toSidecarDlsiteState({
      rjCode: "RJ123456",
      status: "error",
      lastAttemptAt: "2026-01-01T00:00:00.000Z",
      error: "failed",
      errorKind: "parse_error",
      appliedTags: nts(["genre/耳かき"]),
    }),
    {
      rjCode: "RJ123456",
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: nts(["genre/耳かき"]),
    },
  );
});

test("projectDlsiteState: applied は cache 失敗より優先する", () => {
  const projected = projectDlsiteState(
    {
      rjCode: "RJ123456",
      status: "applied",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: nts(["genre/耳かき"]),
    },
    {
      kind: "failure",
      outcome: "not_found",
      attemptedAt: 1_000,
      expiresAt: 9_000,
    },
  );
  assert.equal(projected.status, "applied");
  assert.equal(projected.error, null);
});

test("projectDlsiteState: cache の not_found を none 作品へ投影する", () => {
  const projected = projectDlsiteState(
    { ...emptyDlsiteState(), rjCode: "RJ123456" },
    {
      kind: "failure",
      outcome: "not_found",
      attemptedAt: 1_700_000_000_000,
      expiresAt: 1_800_000_000_000,
    },
  );
  assert.equal(projected.status, "not_found");
  assert.equal(projected.errorKind, "not_found");
  assert.equal(projected.lastAttemptAt, "2023-11-14T22:13:20.000Z");
});

test("projectDlsiteState: cache の parse_error を投影する", () => {
  const projected = projectDlsiteState(
    { ...emptyDlsiteState(), rjCode: "RJ123456" },
    {
      kind: "html",
      outcome: "parse_error",
      fetchedAt: 1_700_000_000_000,
      expiresAt: 1_800_000_000_000,
      html: "<html></html>",
    },
  );
  assert.equal(projected.status, "error");
  assert.equal(projected.errorKind, "parse_error");
});

test("shouldRefreshDlsiteProjectionAfterFetch: offline は投影しない", () => {
  assert.equal(
    shouldRefreshDlsiteProjectionAfterFetch({
      ok: false,
      kind: "offline",
      message: "offline",
    }),
    false,
  );
  assert.equal(
    shouldRefreshDlsiteProjectionAfterFetch({
      ok: false,
      kind: "not_found",
      message: "404",
    }),
    true,
  );
});

test("projectDlsiteState: cache ok は none のまま", () => {
  const projected = projectDlsiteState(
    { ...emptyDlsiteState(), rjCode: "RJ123456" },
    {
      kind: "html",
      outcome: "ok",
      fetchedAt: 1_000,
      expiresAt: 9_000,
      html: "<html>ok</html>",
    },
  );
  assert.equal(projected.status, "none");
});
