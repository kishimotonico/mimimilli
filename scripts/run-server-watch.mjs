#!/usr/bin/env node
// server起動ラッパー。
//
// bun --watch は起動時プロセスのcwd（top_level_dir）配下しか監視対象にしない。
// server/ をcwdに `bun --watch src/index.ts` を実行すると、workspace依存の
// shared/src/*.ts がリポジトリルート配下にあるため監視対象外になり、
// shared編集時にserverが自動再起動しない。
//
// このスクリプトはbunプロセス自体をリポジトリルートをcwdとして起動することで
// shared/src を監視対象に含める。portless（アプリ名解決に server/package.json の
// portless フィールドを使う）はこのスクリプトを呼び出す側のcwd（server/）のまま
// 変更しない。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnAndForward } from "./lib/spawnAndForward.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

spawnAndForward("bun", ["--watch", "server/src/index.ts"], {
  cwd: repoRoot,
  env: process.env,
});
