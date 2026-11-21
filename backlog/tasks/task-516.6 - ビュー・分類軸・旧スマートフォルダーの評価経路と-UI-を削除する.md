---
id: TASK-516.6
title: ビュー・分類軸・旧スマートフォルダーの評価経路と UI を削除する
status: To Do
assignee: []
created_date: '2026-11-21 20:24'
labels:
  - library
  - cleanup
dependencies:
  - TASK-516.5
documentation:
  - docs/adr/0040-smart-folder-condition-tree.md
parent_task_id: TASK-516
priority: high
ordinal: 607000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
データ層の切り替え後に、使われなくなった旧経路を残さず消す段。対象の例: filterByView・viewConditions・RECENT_VIEW_WINDOW_DAYS、getAxisFacets と getSmartFolderAxisFacets の2本、evalSmartFolder・evalSmartFolderRules と2段階評価（smartFolderWorks.ts）、旧ルール型（conjunction の直列チェーン）、tagOp、サーバー側の seed 発行3か所と応答の seed、RESERVED_AXIS_IDS、SmartFolderEditorModal 一式、設定画面の軸表示トグル（TagPrefixRow など）。削除後に旧名が残っていないことを rg で確かめる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 上の旧名（filterByView・viewConditions・evalSmartFolder・evalSmartFolderRules・getSmartFolderAxisFacets・tagOp・RESERVED_AXIS_IDS・SmartFolderEditorModal・show_as_axis・randomSeedAtom）が client・server・shared で rg 0 件
- [ ] #2 サーバーが seed を発行せず、作品一覧の応答に seed が無い
- [ ] #3 設定画面から軸表示のトグルが消え、prefix 定義は表示ラベル・色・保護・表示優先度だけを持つ
- [ ] #4 削除で不要になったテストも消え、契約テストは条件の木の1形式だけになっている
- [ ] #5 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
