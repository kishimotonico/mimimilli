---
id: TASK-352
title: busyTimeoutテストのWorker起動失敗フレーキーを解消する
status: Done
assignee: []
created_date: '2026-08-18 01:15'
updated_date: '2026-08-18 02:51'
labels: []
dependencies: []
ordinal: 362000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests/real/busyTimeout.test.ts の「別接続が書き込みロックを保持中でもbusy_timeoutにより書き込みが待機して成功する」が、フル並列実行時に低頻度で失敗する。

エラー: Error: Worker failed during write（busyTimeout.test.ts:101。worker の error イベント発火）

## 実測（統括、2026-08-18）

- 統合ブランチ feat/flaky-tests: server単独フル並列 1/18 失敗、pnpm test（run-p） 1/4 失敗。合計およそ 4/25
- master（6d80fe3）: server単独フル並列 0/15、pnpm test 0/4。合計 0/19 でこのテストの失敗は観測されず（ただしmasterでは TASK-341 のDLsiteフレーキーが別途 1/4 で再現する）
- 単体実行（bun test tests/real/busyTimeout.test.ts）ではmaster 8回連続とも成功。フル並列時のみ

## 帰属は未確定

このバッチのserver側の変更は TASK-341 の scanWorker.ts（DlsiteCacheのclose追加）1点のみで、busyTimeoutのworker（busyTimeoutWriteWorker.ts）とは経路が無関係に見える。一方で発生率の差（4/25 対 0/19）は帰属を否定するほど小さくもない。統計的には有意と言えない水準（Fisher検定でp≒0.13）で、サンプル不足。

## 進め方

worker が error イベントを出す原因（openDb内での例外か、worker起動そのものの失敗か）を特定する。エラーの中身が握り潰されている（error イベントから Error オブジェクトを取り出していない）ため、まず worker の error イベントから実際の例外内容を取り出せるようにして観測すること。

帰属の切り分けは、scanWorker.ts の変更のみを戻した状態で十分な回数（30回以上）回して比較する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 worker の error イベントから実際の例外内容（message・stack）が取得でき、失敗時にそれが報告される
- [x] #2 失敗の原因が特定されタスクnotesに記録されている（TASK-341の変更に帰属するか否かの判断を含む）
- [x] #3 原因構造が修正され、server単独フル並列とpnpm testをそれぞれ20回連続実行して当該テストが失敗しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 原因と修正（2026-08-18）

**原因**: `applySqliteBusyTimeout` が `new Database(...)` の直後ではなく、`PRAGMA journal_mode = WAL` や `PRAGMA user_version` などロックを取る文の後に実行されていた。他接続が書き込みロックを保持していると、busy_timeout 設定前の文が即座に SQLITE_BUSY で失敗する。TASK-341 で観測された dlsiteCache の `PRAGMA journal_mode = WAL` 失敗と同じ機構。

**修正**:
- `server/src/adapters/real/db.ts`: `openVersionedDatabase` 内の全 `new Database`（初回オープン・バージョン不一致再オープン・候補DB・置換後再オープン）直後に `applySqliteBusyTimeout` を移動。従来の pragma ブロック末尾からは削除。
- `server/src/adapters/real/dlsiteCache.ts`: 同様に接続直後へ移動。
- テスト: prepare/write 分離を元に戻し、ロック保持中に `openDb` する形を復元。`db.close()` を finally に復活。`workerFailureError` による error イベント詳細化は維持。

**検証**:
- `bun test tests/real/busyTimeout.test.ts` ×10: 全 pass
- `bun test tests --parallel` ×10: 全 pass
- `pnpm check`: pass

統括による検証（2026-08-18）: 修正後、busyTimeout.test.ts 単体10回連続、bun test tests --parallel 12回連続、pnpm test（run-p）10回連続、いずれも失敗なし（修正前は約4/25）。

帰属の結論: TASK-341には帰属しない。両者は同じプロダクト欠陥（busy_timeoutがロックを取る文より後に設定されていた）を根本原因として共有していた。TASK-341で観測されたスタックも dlsiteCache.ts:177 の PRAGMA journal_mode = WAL の SQLITE_BUSY であり同一機構。341の修正（scanWorkerでのDlsiteCache接続解放）は誘因を1つ潰したもので有効だが、順序の脆さは残っていた。本タスクでそれを解消した。
<!-- SECTION:NOTES:END -->
