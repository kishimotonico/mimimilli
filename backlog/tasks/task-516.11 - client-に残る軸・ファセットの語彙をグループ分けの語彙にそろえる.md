---
id: TASK-516.11
title: client に残る軸・ファセットの語彙をグループ分けの語彙にそろえる
status: Done
assignee: []
created_date: '2026-11-22 14:57'
updated_date: '2026-11-22 15:25'
labels:
  - library
  - refactor
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 612000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
軸レールとビュー・分類軸の撤去（TASK-516.6・516.7）のあと、client に AxisFacetItem・AxisId・useAxisFacetsQuery・FacetScope・facetItems・buildFacetAxisRows・axisDefinitions.ts・AxisValueList/Rows/Grid/QuickList/PopoverPanel・axisValueSort/Hierarchy/Filter/RowNav/DisplayRows・CSS の is-axis-values などの軸の語彙が残っている。グループ分け（GroupBy）とその値の語彙にそろえる。shared の axisFacetListSchema など API 契約の名前も対象。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 名前の変更だけで挙動が変わっていない（client の単体テスト全体と pnpm test:smoke が通る）
- [x] #2 docs/design-system.md・docs/ARCHITECTURE.md・docs/HANDOFF.md の該当する名前が新しい語彙に合っている
- [ ] #3 client・shared・server の src とテストで、旧概念を指す axis・facet の識別子・ファイル名・CSS クラスが rg で残っていない（残すものは理由をタスクのメモに書く）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
名前の対応表（実装済み）
- 型・shared: AxisFacetItem→GroupValueItem、AxisFacetCover→GroupValueCover、axisFacet*Schema→groupValue*Schema
- AxisId は廃止し GroupBy を直接使う（axisOfGroupBy/groupByOfAxis も廃止）。getAxisLabel/getAxisIcon→getGroupByLabel/getGroupByIcon(groupBy)、FacetAxisRow→GroupByRow{groupBy,name,icon}、buildFacetAxisRows→buildGroupByRows、axisDefinitions.ts→smartFolderDefinitions.ts
- buildFilterTag(groupBy, value)、filterValidFacetItems→filterValidGroupValueItems(groupBy, items)
- 擬似タグ（shared/pseudoTag）: buildBuiltinAxisTag→buildBuiltinPseudoTag、parseBuiltinAxisTag→parseBuiltinPseudoTag（フィールド axis→key）、isBuiltinPseudoTagAxis→isBuiltinPseudoTagKey、ParsedBuiltinAxisTag→ParsedBuiltinPseudoTag
- フック・スコープ: useAxisFacetsQuery→useGroupValuesQuery(groupBy|null, scope)、FacetScope→GroupValueScope、facetItems→groupValueItems、isFacetLoading/Error→isGroupValuesLoading/Error、refetchFacets→refetchGroupValues、onRetryFacets→onRetryGroupValues
- 部品: AxisValue{List,Rows,Grid,QuickList,PopoverPanel}→GroupValue*、useAxisValueListNav→useGroupValueListNav、axisLabel prop→groupByLabel、axis prop→groupBy、AxisPickerStage→GroupByPickerStage
- モデル: axisValue{Sort,Hierarchy,Filter,RowNav,DisplayRows}→groupValue*、axisValueSortAtom→groupValueSortAtom、AXIS_VALUE_*→GROUP_VALUE_*
- query key: ["axisFacets",…]→["groupValues",…]、scopedFacets→scopedGroupValues(folderId, groupByKey, filter)、allFacets→allGroupValues
- CSS: is-axis-values→is-group-values
- server: core/axisFacets.ts→core/groupValues.ts（buildGroupValues）、axisFacetSql→groupValueSql、AxisFacetRow→GroupValueRow
残したもの
- DB 列 tags.facet_sort_key（server catalogSchema / catalogWorkRepository / workQueryRepository / bench）: 列名変更は drizzle マイグレーションが要るため語彙変更から外した。変えるなら別タスク
- 画面の文言（絞り込む軸、分類軸の取得に失敗しました）: 方針どおり変更しない
- docs/design-system.md の typography 軸: 無関係
- localStorage キー・HTTP パスの変更なし

最終の通しテスト（a82e3c91）で pnpm check・pnpm test（server 1323・client 1655）・pnpm test:smoke（70件）が通過。AC#3 の facet_sort_key は TASK-516.14 で改名する。
<!-- SECTION:NOTES:END -->
