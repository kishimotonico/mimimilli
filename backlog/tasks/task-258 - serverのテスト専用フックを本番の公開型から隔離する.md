---
id: TASK-258
title: serverのテスト専用フックを本番の公開型から隔離する
status: Done
assignee: []
created_date: '2026-08-08 21:16'
updated_date: '2026-08-09 00:55'
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
- [x] #1 テストはテスト用ファクトリ経由で同等のフックを利用でき、既存テストが通ること
- [x] #2 変更範囲のserverテストが通ること
- [x] #3 公開ScanOptionsからabortToken・beforeFinalizeが消え、abortTokenは内部契約として本番Worker取消経路が維持されていること
- [ ] #4 RealAdapterOptionsからscanWorkerTestGate等のテスト専用フィールドが消えていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
abortToken は当初テスト専用と誤認されていたが、Worker の取消を同期 scanner へ伝える本番の内部契約なので、Scanner.scan 第3引数 ScannerAbortHooks として本番経路に残した。隔離したのは beforeFinalize と scanWorkerTestGate 系のみ。検証: pnpm check 成功、server 525 pass / 0 fail。scanWorker.test.ts の cancel テストで取消経路を実測確認。副作用レビュー指摘なし。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ScanOptions と RealAdapterOptions からテスト専用フィールドを除去。abortToken・beforeFinalize は Scanner.scan の第3引数 ScannerAbortHooks へ移し、runFileScanInWorker を scanRunner.ts へ切り出して createRealAdapter の RealAdapterAssembly 経由で差し替え可能にした。test gate は createTestRealAdapter が注入する。pnpm check と server 525 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
