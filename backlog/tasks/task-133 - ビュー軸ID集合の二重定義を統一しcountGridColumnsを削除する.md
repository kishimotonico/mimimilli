---
id: TASK-133
title: ビュー軸ID集合の二重定義を統一しcountGridColumnsを削除する
status: To Do
assignee: []
created_date: '2026-07-30 12:29'
labels: []
dependencies: []
priority: medium
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client model層の重複定義とデッドコードの整理（敵対的検証済み）。

1. ビュー軸ID集合の二重ハードコード（medium）: client/src/features/library/model/axisDefinitions.ts:11,28 の VIEW_AXIS_IDS/VIEW_AXES と、client/src/features/navigation/model/navigationUrl.ts:40 のローカル VIEW_AXES が同一リテラル集合（all/recent/added/fav/unplayed/missing）を独立定義。navigationUrl.ts:87,97 の判定ロジックも axisDefinitions.ts:30-38 の isViewAxis/isFacetAxis を再実装している。axisDefinitions.ts自身のコメントが「一元管理」を謳っており方針違反。軸の追加・削除時にURLパースと軸判定が食い違う不具合の温床。検証で循環importにならないことを確認済み（navigationUrl.tsは既に ../../library/model/types へ依存しており、axisDefinitions側にnavigationへの依存はない）。
2. countGridColumns のデッドコード（low）: client/src/features/library/model/gridNavigation.ts:5-11。本番コードからの呼び出しゼロで、唯一の利用者が client/tests/unit/gridNavigation.test.ts:3,10-12（テストだけが未使用関数を生かしている状態）。実際の列数計算は WorkGrid.tsx:177 が gridSizing.ts の computeGridColumnCount を使用。関数とテストを削除する。

注意: AxisColumn.tsx:14 にも同名 VIEW_AXES があるがこちらはUI表示行データ（AxisRow[]）で別物。対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 navigationUrl.ts が axisDefinitions.ts の VIEW_AXES / isViewAxis / isFacetAxis をimportし、ローカルの重複定義・重複ロジックが削除されている
- [ ] #2 countGridColumns と対応するテストケースが削除されている
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
