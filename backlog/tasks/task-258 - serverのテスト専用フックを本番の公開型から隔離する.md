---
id: TASK-258
title: serverのテスト専用フックを本番の公開型から隔離する
status: To Do
assignee: []
created_date: '2026-08-08 21:16'
updated_date: '2026-08-09 00:26'
labels: []
dependencies: []
priority: high
ordinal: 268000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。テスト都合のオプションが本番の公開契約に混入している。
- server/src/adapter.ts:42-51 ScanOptions の beforeFinalize はWorker結合テスト専用
- server/src/adapters/real/index.ts:42-47 RealAdapterOptions の scanWorkerTestGate 等も同様
- 注意（Codexレビュー反映）: abortToken はテスト専用ではない。本番Workerの取消を同期scannerへ伝える内部契約（real/index.ts:80-92 → scanWorker.ts:61-65 → scanner.ts）。公開ScanOptionsからは外すが、InternalScanOptions等の本番内部契約へ移して経路を維持する
beforeFinalize・scanWorkerTestGate はテスト用ファクトリ（createTestRealAdapter系）へ移し、本番型から除去する。metaIdMigrationのテスト専用フックはTASK-261で扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 テストはテスト用ファクトリ経由で同等のフックを利用でき、既存テストが通ること
- [ ] #2 変更範囲のserverテストが通ること
- [ ] #3 公開ScanOptionsからabortToken・beforeFinalizeが消え、abortTokenは内部契約として本番Worker取消経路が維持されていること
- [ ] #4 RealAdapterOptionsからscanWorkerTestGate等のテスト専用フィールドが消えていること
<!-- AC:END -->
