---
id: TASK-516.6
title: ビュー・分類軸・旧スマートフォルダーの評価経路と UI を削除する
status: Done
assignee: []
created_date: '2026-11-21 20:24'
updated_date: '2026-11-22 10:42'
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
- [x] #1 上の旧名（filterByView・viewConditions・evalSmartFolder・evalSmartFolderRules・getSmartFolderAxisFacets・tagOp・RESERVED_AXIS_IDS・SmartFolderEditorModal・show_as_axis・randomSeedAtom）が client・server・shared で rg 0 件
- [x] #2 サーバーが seed を発行せず、作品一覧の応答に seed が無い
- [x] #3 設定画面から軸表示のトグルが消え、prefix 定義は表示ラベル・色・保護・表示優先度だけを持つ
- [x] #4 削除で不要になったテストも消え、契約テストは条件の木の1形式だけになっている
- [x] #5 pnpm check と変更範囲のテストが通る
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
516.2 レビューからの引き継ぎ: (1) 旧経路の撤去と同時に docs/adr/0008-*.md の core↔SQL 二重実装の例外表（applyWorksQuery↔queryWorks、getAxisFacets、evalSmartFolderRules の文など）を ADR-0040「ADR-0008 の例外表の改訂」どおりに書き換え、docs/ARCHITECTURE.md も conditionContract.test.ts・compileCondition/matchCondition に合わせる。(2) 516.2 で旧 WorkAdapter.queryWorks を queryWorksLegacy に改名した。旧経路と一緒に消し、app.test.ts の旧経路向け ids テストも消す。

516.3 で tag_prefixes.show_as_axis を DROP したため、設定画面の軸表示トグル（TagPrefixRow・TagPrefixSettings）と shared の showAsAxis は 516.3 で撤去済み。AC#3 は確認だけでよい。516.3 時点で到達不能として残した旧コード: core/smartFolder.ts、smartFolderWorks.ts、workQuerySql の旧関数、shared の smartFolderPreviewResponseSchema・SmartFolderEvalQuery・旧 smartFolderListSchema など。client はまだ旧 smartFolderListSchema で /smart-folders を parse している（516.5 で置き換え）。

516.5 からの引き継ぎ: client/src/features/library/model/valueSelectionContract.ts は自分のテスト以外から参照されていないので消す。shared/library.ts の旧 smartFolderSchema・smartFolderListSchema と server の /axes・/works の旧経路も消す。
<!-- SECTION:NOTES:END -->
