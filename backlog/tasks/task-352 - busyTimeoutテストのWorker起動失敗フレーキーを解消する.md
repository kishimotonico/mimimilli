---
id: TASK-352
title: busyTimeoutテストのWorker起動失敗フレーキーを解消する
status: In Progress
assignee: []
created_date: '2026-08-18 01:15'
updated_date: '2026-08-18 01:17'
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
- [ ] #1 worker の error イベントから実際の例外内容（message・stack）が取得でき、失敗時にそれが報告される
- [ ] #2 失敗の原因が特定されタスクnotesに記録されている（TASK-341の変更に帰属するか否かの判断を含む）
- [ ] #3 原因構造が修正され、server単独フル並列とpnpm testをそれぞれ20回連続実行して当該テストが失敗しない
<!-- AC:END -->
