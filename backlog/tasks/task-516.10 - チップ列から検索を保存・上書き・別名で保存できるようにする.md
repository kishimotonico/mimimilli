---
id: TASK-516.10
title: チップ列から検索を保存・上書き・別名で保存できるようにする
status: Done
assignee: []
created_date: '2026-11-21 20:24'
updated_date: '2026-11-22 14:57'
labels:
  - library
  - ui
dependencies:
  - TASK-516.8
documentation:
  - docs/adr/0041-library-sidebar-shell-navigation.md
  - docs/adr/0040-smart-folder-condition-tree.md
parent_task_id: TASK-516
priority: high
ordinal: 611000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0041「並び順メニューと保存の操作」と ADR-0040「条件の編集」の保存の中身の実装。常設のチップ列の右端（行は増やさない）に、状態に応じて保存の操作を出す: 保存先が無い絞り込み（すべて・既定のもの・グループ分けを持つ自作のもの）は「検索を保存」、自作でグループ分けを持たないものでチップを足したか並びを変えたときは「上書き」「別名で保存」、検索語だけなら「検索を保存」。保存直後に同じ作品が見えるように条件を組む（元の条件＋グループの値＋チップ＋検索語。グループ分けを外すのは値を選んでいるときだけ。既定の並びは今の並びを変えていなければ「『すべて』と同じ」）。上書きは自作かつグループ分けなしだけ。構想の2本の流れを smoke にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 状態ごとに出る保存の操作が ADR-0041 の表どおりで、既定のものとグループ分けを持つものには上書きが出ない
- [x] #2 CV別で値を選び検索して「検索を保存」し、開き直すと保存前と同じ作品が同じ並びで見える（smoke）
- [x] #3 値を選んでいないグループ分けのものから保存すると、グループ分けを保った新しいスマートフォルダーになる
- [x] #4 自作のものでチップを足して上書きすると条件に足され、上書きのトーストの「元に戻す」で条件と並びが戻る
- [x] #5 再生中を閉じて戻るで探索を続ける流れ（ライブラリ → 層 → 閉じる → 戻る）が smoke になっている
- [x] #6 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
保存の中身は shared の buildEffectiveCondition（server/core から移設）に一本化。smoke全体は負荷（load 44）で8本落ち、単独再実行で全通過

AC#3の根拠: 値一覧では＋メニューが複製になり、グループ分けを保つ（smartFolderEditing.test.ts の「複製は元の定義と既定の並びをそのまま写す」）。作品一覧の保存は値選択済みなのでグループ分けは外す。ダイアログのホストはApp overlaysのSmartFolderDialogHost
<!-- SECTION:NOTES:END -->
