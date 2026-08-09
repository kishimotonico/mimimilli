---
id: TASK-258
title: serverのテスト専用フックを本番の公開型から隔離する
status: To Do
assignee: []
created_date: '2026-08-08 21:16'
labels: []
dependencies: []
priority: high
ordinal: 268000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。テスト都合のオプションが本番の公開契約に混入している。
- server/src/adapter.ts:42-51 ScanOptions の abortToken・beforeFinalize はWorker結合テスト専用
- server/src/adapters/real/index.ts:42-47 RealAdapterOptions の scanWorkerTestGate 等も同様
テスト用ファクトリ（createTestRealAdapter系）へ移し、本番型から除去する。metaIdMigrationのテスト専用フックは別タスク（レガシー移行の手動化）で扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanOptions・RealAdapterOptions の公開型からテスト専用フィールドが消えていること
- [ ] #2 テストはテスト用ファクトリ経由で同等のフックを利用でき、既存テストが通ること
- [ ] #3 変更範囲のserverテストが通ること
<!-- AC:END -->
