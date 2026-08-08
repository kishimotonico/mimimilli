import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { getCategoryLogger, initLogger } from "../src/lib/logger.ts";

test("initLogger は logDir 指定時に file sink へ渡した絶対パスを返す", () => {
  const logDir = mkdtempSync(join(tmpdir(), "mimimilli-logger-"));
  try {
    const { logFilePath } = initLogger({ logDir });
    assert.ok(logFilePath);
    assert.equal(logFilePath, join(logDir, logFilePath.slice(logFilePath.lastIndexOf("/") + 1)));
    assert.match(logFilePath, /server-\d{4}-\d{2}-\d{2}\.jsonl$/);

    getCategoryLogger("server").info("テストログ");
    assert.ok(existsSync(logFilePath));
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test("initLogger は logDir 未指定時に null を返す", () => {
  const { logFilePath } = initLogger();
  assert.equal(logFilePath, null);
});

test("initLogger はログディレクトリの作成に失敗したとき errno 付きのエラーを投げる", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mimimilli-logger-"));
  try {
    const blockerPath = join(baseDir, "notadir");
    writeFileSync(blockerPath, "blocked");
    const logDir = join(blockerPath, "logs");

    assert.throws(
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
