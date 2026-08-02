---
id: TASK-169
title: LogTapeでJSONLログ基盤を導入しプロセスの安全網を張る
status: To Do
assignee: []
created_date: '2026-08-02 06:59'
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
- [ ] #1 DataPathsにlog/が追加されWindows/WSL両方で正しいパスに解決される
- [ ] #2 ログがstdoutと日付サフィックスのJSONLファイルの両方へ出力され、jq -r .messageで日本語メッセージが読める
- [ ] #3 起動時にN日より古いログファイルが削除される
- [ ] #4 uncaughtException/unhandledRejectionが最終ログを記録してから終了する
- [ ] #5 graceful shutdownでRealAdapter.close()が呼ばれログがflushされる
- [ ] #6 server/srcの既存console.*とdlsiteLoggerが新loggerへ置き換わっている
- [ ] #7 pnpm checkとpnpm testが通る
<!-- AC:END -->
