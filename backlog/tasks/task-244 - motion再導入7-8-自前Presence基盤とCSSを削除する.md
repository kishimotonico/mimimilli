---
id: TASK-244
title: 'motion再導入(7/8): 自前Presence基盤とCSSを削除する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 19:09'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手前提条件（統括記録・レビュー由来）

TASK-244 は usePresence / Presence / presenceDurations.ts / presence.test.tsx を削除するが、旧Presenceの消費者は計8ファイルある（grep確認済み）:

TopBar.tsx / ScanModal.tsx / LibraryView.tsx / AxisQuickOverlay.tsx / AxisValueQuickList.tsx / FilterChipAddButton.tsx / AxisValuePopoverPanel.tsx / FilesView.tsx

これらが TASK-239 / 240 / 241 / 243 で全て移行済みであることが着手の前提条件。1つでも残っていると削除できない。着手時に `rg -n "usePresence|from .*Presence" client/src/` で残存0を確認すること。

## presence.test.tsx 削除時に失われる検証（TASK-242レビューで確定）

移管前は計6件（usePresence汎用4 + Presence汎用1 + PlayerDock固有1）。PlayerDock固有1件は playerDock.test.tsx の3件へ移管済み（上位互換）。残る汎用5件（skipInitial系3・初回不在→出現でenter・高速トグルで退出中shownに戻らない・onExitComplete一回）は**汎用メカニズム自体のテスト**であり、メカニズムごと削除されるため失うことに問題はない。PlayerDockの挙動保証は playerDock.test.tsx / playerDockPopupListeners.test.tsx が完全にカバーしている。**presence.test.tsx は削除してよい。**

## shell.css 削除時の注意（TASK-239由来）

TASK-239 が `.mll-bar` に `position: relative` を**新規追加**している（fade退出のposition:absoluteが効くための positioned ancestor）。これはPresence系セレクタではなく必須のレイアウト修正なので、**削除リストに含めず維持すること**。

## 維持対象（ADR確定事項の再掲）

.mle-colstack__edges / .ml-file-col-enter / 装飾系keyframes（barwave/EQ/skeleton等）とそれらのreduced-motion指定は維持。collapseはgridトリックのみ削除し子レイアウトflex/gapは維持。実施時に行番号を再確認すること。
<!-- SECTION:NOTES:END -->
