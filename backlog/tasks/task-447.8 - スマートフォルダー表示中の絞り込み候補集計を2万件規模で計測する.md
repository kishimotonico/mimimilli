---
id: TASK-447.8
title: スマートフォルダー表示中の絞り込み候補集計を2万件規模で計測する
status: To Do
assignee: []
created_date: '2026-09-11 00:53'
labels:
  - ux
  - perf
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 476000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 AC#5。残す判定の 432 は、スマートフォルダー表示中に軸を切り替えるたび、フォルダー条件の評価と軸集計を JS で2段の全件走査する（tmp/uiux-triage-2026-09-11/design-review.md (B)-3）。実データは使わず、計測用 worktree だけで server/src/adapters/fixture/scenarios.ts の LARGE_SCENARIO_WORK_COUNT を 20000 に上げて計測する（変更はコミットしない）。fixture 側は adapters/fixture/classification.ts で core の evalSmartFolderRules を使うので、real adapter の SQL 部分とは経路が違う点を結果に明記する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 計測用 worktree で LARGE_SCENARIO_WORK_COUNT を 1000 と 20000 にした2条件で、スマートフォルダー表示中の軸切替時の facets API 応答時間とクライアントの longtask を計測している
- [ ] #2 比較として、スマートフォルダー外（すべての作品）で同じ軸切替を計測している
- [ ] #3 fixture と real adapter の処理経路の違い（どこまでが同じコードか）を結果に明記している
- [ ] #4 計測手順と結果の表をタスクメモに記録し、LARGE_SCENARIO_WORK_COUNT の変更はコミットされていない
<!-- AC:END -->
