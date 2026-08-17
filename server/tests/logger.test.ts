import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { dispose, formatError, getCategoryLogger, initLogger } from "../src/lib/logger.ts";

test("initLogger は logDir 指定時に debug も含めてJSONLへ記録する", async () => {
  const logDir = mkdtempSync(join(tmpdir(), "mimimilli-logger-"));
  try {
    const { logFilePath } = await initLogger({ logDir });
    assert.ok(logFilePath);
    assert.equal(dirname(logFilePath), logDir);
    assert.match(logFilePath, /server-\d{4}-\d{2}-\d{2}\.jsonl$/);

    getCategoryLogger("http").debug("テストデバッグログ", { status: 200 });
    getCategoryLogger("server").info("テストログ");
    await dispose();

    const lines = readFileSync(logFilePath, "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const debugLine = lines.find((line) => line.message === "テストデバッグログ");
    assert.ok(debugLine);
    assert.equal(debugLine.level, "DEBUG");
    assert.equal(debugLine.category, "http");
    assert.deepEqual(debugLine.properties, { status: 200 });
    assert.ok(lines.some((line) => line.level === "INFO" && line.message === "テストログ"));
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test("initLogger は logDir 未指定時に null を返す", async () => {
  const { logFilePath } = await initLogger();
  assert.equal(logFilePath, null);
  await dispose();
});

test("initLogger はログディレクトリの作成に失敗したとき errno 付きのエラーを投げる", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mimimilli-logger-"));
  try {
    const blockerPath = join(baseDir, "notadir");
    writeFileSync(blockerPath, "blocked");
    const logDir = join(blockerPath, "logs");

    await assert.rejects(
      () => initLogger({ logDir }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /ログディレクトリの作成に失敗しました/);
        assert.match(error.message, new RegExp(logDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(error.message, /ENOTDIR/);
        assert.ok(error.cause instanceof Error);
        return true;
      },
    );
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("formatError は非Errorのreasonで型と内容を判別できる", () => {
  assert.deepEqual(formatError({ code: "ENOENT", path: "/tmp/missing" }), {
    errorKind: "object",
    content: '{"code":"ENOENT","path":"/tmp/missing"}',
  });
  assert.deepEqual(formatError("plain failure"), {
    errorKind: "string",
    content: '"plain failure"',
  });
  assert.deepEqual(formatError(42), {
    errorKind: "number",
    content: "42",
  });
  assert.deepEqual(formatError(null), {
    errorKind: "null",
    content: "null",
  });
  assert.deepEqual(formatError(undefined), {
    errorKind: "undefined",
    content: "undefined",
  });
  assert.deepEqual(formatError(0), {
    errorKind: "number",
    content: "0",
  });
  assert.deepEqual(formatError(""), {
    errorKind: "string",
    content: '""',
  });
});

test("formatError はfsエラーの code / errno / syscall / path を含める", () => {
  const error = Object.assign(new Error("ENOENT: no such file"), {
    code: "ENOENT",
    errno: -2,
    syscall: "stat",
    path: "/tmp/missing",
  });

  assert.deepEqual(formatError(error), {
    errorKind: "Error",
    message: "ENOENT: no such file",
    stack: error.stack,
    code: "ENOENT",
    errno: -2,
    syscall: "stat",
    path: "/tmp/missing",
  });
});

test("formatError は cause / suppressed の既存挙動を維持する", () => {
  const cause = Object.assign(new Error("root cause"), { code: "EACCES", path: "/secret" });
  const suppressed = Object.assign(new Error("suppressed"), {
    code: "EBUSY",
    syscall: "unlink",
  });
  const error = new Error("wrapper", { cause });
  (error as { suppressed?: unknown[] }).suppressed = [suppressed];

  const formatted = formatError(error);
  assert.equal(formatted.errorKind, "Error");
  assert.equal(formatted.message, "wrapper");
  assert.equal(formatted.stack, error.stack);
  assert.deepEqual(formatted.cause, {
    errorKind: "Error",
    message: "root cause",
    code: "EACCES",
    path: "/secret",
  });
  assert.deepEqual(formatted.suppressed, [
    {
      errorKind: "Error",
      message: "suppressed",
      code: "EBUSY",
      syscall: "unlink",
    },
  ]);
});
