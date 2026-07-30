---
id: TASK-158
title: SQLite接続にbusy_timeoutを設定し並行書き込み時の操作失敗を防ぐ
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:54'
updated_date: '2026-07-30 18:12'
labels: []
dependencies: []
priority: high
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/db.ts:43付近の接続初期化にbusy_timeoutが未設定。メイン接続とスキャンWorkerが同じDB（特にuser DB）へ書き込むため、スキャン中のユーザー操作がSQLITE_BUSYで即時失敗しうる。性能というより堅牢性の改善（Codexレビューで優先度高と判定）。PRAGMAの一括チューニング（cache_size/mmap_size等）は根拠がないため行わない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 全SQLite接続（catalog/user、メイン/Worker）にbusy_timeoutが設定されている（値の根拠をコメントまたはタスクに記録）
- [x] #2 スキャン実行中の書き込み系ユーザー操作が即時SQLITE_BUSYで失敗しないことをテストで確認する
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. db.tsの接続初期化（メイン/Worker、catalog/user）にbusy_timeout PRAGMA追加
2. スキャン並行書き込み時にSQLITE_BUSY即時失敗しないテスト追加
実装はCursor委譲
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
sqliteConnection.tsにSQLITE_BUSY_TIMEOUT_MS=5000の共有ヘルパーを追加し、openDb（catalog/user/Worker/bench経由含む）とDlsiteCacheの全接続に適用。別接続がBEGIN IMMEDIATEでロック保持中でも待機して書き込み成功するテストを追加。server 357テスト・pnpm check全通過。実装Cursor委譲。
<!-- SECTION:FINAL_SUMMARY:END -->
