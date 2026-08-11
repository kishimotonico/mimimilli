---
id: TASK-253
title: serverテストの並列実行時フレーキー（busy_timeoutのロック待ち）を解消する
status: Done
assignee: []
created_date: '2026-08-08 10:25'
updated_date: '2026-08-11 10:52'
labels: []
dependencies: []
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-252の検証中に pnpm test（run-p でserver/clientを同時実行）でserver側が1件失敗した。server単独で再実行すると505件全通過するため、並列実行時のリソース競合によるフレーキーと判断した。

該当は busy_timeout のロック待ちタイムアウト系テスト。clientのvitestと同時に走ることでSQLiteのロック待ちが想定より延びていると推測される。TASK-252の変更とは無関係。

pnpm test を並列のまま安定させるか、当該テストをロック競合に影響されない形にするかを決めて対応する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pnpm test（server/client同時実行）を連続3回実行してserver側が安定して通る
- [x] #2 フレーキーの原因が特定されタスクのnotesに記録されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-09のリファクタ一斉改善バッチで再観測。server単独の pnpm test（bun test --parallel、12スレッド）でも発生する。該当テストは2件: 「file scan Workerの同期停止中もworks/Range mediaへ応答し、cancel後に再scanできる」（scanWorker.test.ts。Worker起動が test gate の2秒タイムアウトに間に合わない）と「スマートフォルダー候補IDが900件を超えてもlistSummariesのchunk境界をまたいで同値」（worksQueryContract.test.ts）。いずれも実行時間が5秒級に膨らんだうえでのタイムアウトで、単独実行では確実に通る。TASK-270（scanner分割）投入の前後でA/B比較したところ、投入前の状態でも3回中3回発生したため機能的な退行ではなく既存のフレーキー。busy_timeout のロック待ちだけでなく、Worker起動待ちのハードコードされた短いタイムアウトも原因に含まれる。

2026-08-09、smokeテストでも同種の症状を確認。「ライブラリシェル: 軸レール・結果面・チップ列が表示される」（library.smoke.spec.ts:7）が、他タスクの実装・レビューが並行して走る高負荷下でのみ失敗する。症状はwebServer冷起動直後の1本目に固有で、単体実行では成功。同一worktreeで負荷の低い状態では3回とも10件全パス（3回目は31秒で完了）。playwright の webServer 起動待ちと 5秒の toBeVisible タイムアウトが、負荷下で間に合わないことが原因と見られる。serverテストのbusy_timeoutやWorker起動待ちと同じく、ハードコードされた短いタイムアウトが負荷に弱いという共通の構造。

busy_timeout は原因ではなかった。実際の原因は2件とも『待つ対象が明確なのにハードコードされた短いタイムアウトで打ち切っていた』こと。(1) scanWorker.test.ts: Worker到達待ちに既存の readiness シグナル（test-gate-ready → onScanWorkerTestGateReady）があるのに2秒の Promise.race で打ち切っていた。単独実行では1.1〜1.5秒だが並列負荷下でWorker起動が2秒を超える。シグナルをそのまま待つ形へ変更。応答性検証の withDeadline は残したうえで 500ms → 5秒へ緩和（削除するとWorkerブロック退行の診断性が失われるためレビューで差し戻した）。(2) worksQueryContract.test.ts: bun test の既定タイムアウト5000msに、950件INSERTのセットアップ（プレイリスト・トラック付きで単独1.7〜1.9秒）が負荷下で到達していた。chunk境界検証にプレイリストは不要なため軽量シードへ変え db.transaction でまとめた。両テストに timeout 15秒を明示。検証: stress-ng --cpu 8 併用で対象2ファイル並列10回すべて成功、scanWorker 単体は差し戻し後も負荷下5回成功。フルスイート pnpm test 3連続すべて通過（794 tests / 103 files）。pnpm check 通過。ブランチ feat/task-253-flaky-server-parallel（3d18312）。
<!-- SECTION:NOTES:END -->
