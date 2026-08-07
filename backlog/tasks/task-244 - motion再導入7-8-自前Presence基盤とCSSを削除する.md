---
id: TASK-244
title: 'motion再導入(7/8): 自前Presence基盤とCSSを削除する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 17:16'
labels: []
dependencies:
  - TASK-239
  - TASK-240
  - TASK-241
  - TASK-242
  - TASK-243
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md のCSS削除確定事項（フェーズ7）。usePresence.ts・Presence.tsx・presenceDurations.tsを削除。shell.cssはセレクタ単位の削除リスト（.ml-presence-*系の状態セレクタ・[data-phase]複合・modifier・退出中pointer-events規則・reduceブロック内の該当行。collapseはgridトリックのみ削除し子レイアウトflex/gapは維持。実施時に行番号を再確認）で削除し、.mle-colstack__edges・.ml-file-col-enter・装飾系keyframesとそれらのreduce指定は維持。presence.test.tsxはrapid toggle等の移管完了(TASK-242)を確認してから削除。旧Presence利用10ファイルで「フック引数/optionsに開閉stateを渡している呼び出し」を目視総点検（機械的grep不可）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 usePresence・Presenceへの参照が0でファイルが削除されている
- [ ] #2 shell.cssの削除がセレクタ単位リストに従っており維持対象のCSSに差分がない
- [ ] #3 クエリ購読の目視総点検の結果がタスクノートに記録されている
- [ ] #4 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
