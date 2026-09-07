---
id: TASK-434
title: metaCasRaceのタイムアウトが負荷状況で再現する問題を調べる
status: To Do
assignee: []
created_date: '2026-09-07 16:47'
labels:
  - test
  - flaky
  - server
dependencies: []
priority: medium
ordinal: 455000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428系の改修中、複数の担当から `server/tests/real/metaCasRace.test.ts` の「CASとrenameの間に並行書き込みがあっても後勝ち消失しない」がタイムアウト（5000ms）で落ちる報告が繰り返し上がった。各担当は他worktreeとのCPU競合と判断していたが、統括が統合ブランチ（ad27b63）で他に何も走っていない状態で単体実行したところ、5005msでタイムアウトして再現した。

切り分け結果:
- テストファイル自体も、CAS/renameのロジックも、統合ブランチでは一度も変更されていない（`git diff --name-only master..HEAD` で確認）
- したがって TASK-428系の改修由来ではない
- ただしベースライン計測（1c64eda、改修着手時点）では全パスと報告されていた

タイムアウトが5000msと短く、マシンの負荷状況で結果が変わる性質に見える。単に閾値を上げるのが正しいのか、テストの構造（並行書き込みの待ち方）に問題があるのか、あるいは実装側にタイミング依存の弱さがあるのかを切り分ける。

「負荷がかかると落ちるテスト」は、他の失敗の判定精度を下げる。実際この改修中、複数の担当が自分の変更由来かどうかの切り分けに時間を使っている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 metaCasRaceのタイムアウトが、テストの構造・閾値・実装のいずれに起因するかを切り分けて記録する
- [ ] #2 負荷がかかった状態でも安定して結果が出る形になっている（閾値を上げるだけの対処なら、その根拠を記録する）
- [ ] #3 同じ原因で他のテストが落ちていないかを確認する
<!-- AC:END -->
