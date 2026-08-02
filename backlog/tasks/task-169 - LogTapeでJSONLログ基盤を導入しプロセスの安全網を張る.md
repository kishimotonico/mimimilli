---
id: TASK-169
title: LogTapeでJSONLログ基盤を導入しプロセスの安全網を張る
status: Done
assignee: []
created_date: '2026-08-02 06:59'
updated_date: '2026-08-02 07:16'
labels: []
dependencies:
  - TASK-168
priority: high
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計方針（アーティファクト「ログ・トレーサビリティ設計方針」）のフェーズ1。LogTapeで日本語message中心のJSONLログ基盤を作る。必須フィールドはts/level/category(dlsite·scan·db·http·server)/messageの4つ、messageは日本語自由文、絞り込みに使う値（workId・status・durationMs・errorKind等）は文脈フィールドにも入れる。イベントIDは必須にしない。出力先はstdoutとDataPathsに新設するlog/配下の日付サフィックスJSONLファイル（例: server-2026-08-02.jsonl）。ローテーション機構は作らず、起動時にN日より古いファイルを削除するのみ。同時にプロセスの安全網（uncaughtException/unhandledRejectionの最終記録、Hono onErrorのlogger化、RealAdapter.close()がserver entryから呼ばれていない実バグの修正を含むgraceful shutdown）を張り、既存のconsole.*約15箇所とdlsiteLogger(server/src/index.ts:25)をこの基盤へ載せ替える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DataPathsにlog/が追加されWindows/WSL両方で正しいパスに解決される
- [x] #2 ログがstdoutと日付サフィックスのJSONLファイルの両方へ出力され、jq -r .messageで日本語メッセージが読める
- [x] #3 起動時にN日より古いログファイルが削除される
- [x] #4 uncaughtException/unhandledRejectionが最終ログを記録してから終了する
- [x] #5 graceful shutdownでRealAdapter.close()が呼ばれログがflushされる
- [x] #6 server/srcの既存console.*とdlsiteLoggerが新loggerへ置き換わっている
- [x] #7 pnpm checkとpnpm testが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)委譲で実装、統括がレビュー・検証済み。
- server/src/lib/logger.ts新設: LogTape configureSync、console sink(ANSI整形)＋realアダプタ時のみfile sink(自作JSONLフォーマッタ: ts/level/category/message/properties)。meta loggerはwarning以上
- 文脈フィールドはpropertiesにネスト(jqは .properties.workId でアクセス)
- dataRoot.tsにlogDir追加(root/log)、テスト追随
- 起動時purge(14日、LOG_RETENTION_DAYS定数)をスモークで実証(20日前ファイル削除確認)
- 安全網: uncaughtException/unhandledRejection/SIGINT/SIGTERM→shutdown()でRealAdapter.close()＋server.stop()＋await dispose()。close()未呼び出しバグ修正込み
- 残存console: index.ts:91(shutdown中の最終防衛)とdlsiteCacheCli.ts(CLIツール)は意図的に残置
- 検証: pnpm check合格、server 425/client 601テスト全パス、file sink実書き込みスモーク合格
- 既知の割り切り: ログファイル名は起動時の日付で固定(日跨ぎ常駐では前日ファイルに追記継続)
- 副産物: Cursorのpnpm addでlockfileのesbuild@0.28.1 optionalDependencies欠落が再発→根本原因はpnpmメタデータキャッシュ(metadata-ff-v1.3/esbuild.json)の破損と特定、pnpm cache delete esbuildで解消。Windows側fddf384の破損もこれが原因だった可能性が高い
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LogTapeでJSONLログ基盤(stdout＋日付ファイル、14日保持)を導入し、uncaught/シグナルの安全網とgraceful shutdown(RealAdapter.close修正込み)を実装。console.*とdlsiteLoggerを載せ替え。pnpm check・全テスト・file sinkスモークで検証済み
<!-- SECTION:FINAL_SUMMARY:END -->
