---
id: TASK-249
title: TagComboboxの候補検索だけ大文字小文字を無視に戻す
status: Done
assignee: []
created_date: '2026-08-07 17:53'
updated_date: '2026-08-08 07:28'
labels: []
dependencies: []
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-247でTagComboboxの正規化をsharedのnormalizeTag(ADR-0005決定5準拠)へ統一した結果、候補の部分一致フィルタまで大文字小文字を区別するようになった。実害は表記ゆれの増殖で、既存タグ "ASMR" がある状態で "asmr" と打つと候補に出ず、そのままEnterで別タグを新規作成してしまう。ADR-0005 §7は表記ゆれ統合を将来課題としており、現時点でこれを防ぐ手段は候補検索の寛容さしかない。

「タグ同一性(保存時の厳密比較)」と「候補検索(緩い部分一致)」を分離する先例が既にある: client/src/features/library/model/axisValueFilter.ts:14-16 の値一覧ヘッダ検索はtoLowerCase()の部分一致で、ADR-0005の同一性ルールとは独立に運用されている。TagComboboxの候補リストも同種の検索UXなので、この先例へ揃える。

分離の境界: hasExactMatch判定・excludeTags判定・新規作成の可否は厳密なnormalizeTag(TASK-247の現状維持)、includesによる部分一致フィルタのみ大文字小文字を無視する。対象は client/src/shared/ui/TagCombobox.tsx の getTagComboboxOptions。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 候補の部分一致フィルタが大文字小文字を無視し、既存タグ"ASMR"が入力"asmr"で候補に出る
- [x] #2 hasExactMatch判定・excludeTags判定・新規作成の可否は厳密なnormalizeTagのままで、TASK-247で固定した挙動が退行していない
- [x] #3 検索の寛容さと同一性の厳密さが両立することをテストで固定している
- [x] #4 pnpm check と変更範囲のテストが通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
候補の部分一致フィルタのみ大文字小文字を無視に戻した(TagCombobox.tsx:50)。hasExactMatch判定・excludeTags判定・新規作成の可否は厳密なnormalizeTagのままで、TASK-247で固定した同一性の挙動は退行していない。axisValueFilter.ts:14-16の先例(値一覧ヘッダ検索がtoLowerCase().includes())へ揃えた形。既存タグ"ASMR"に対し"asmr"入力で候補が出つつcreateも残ることをテストで固定している。あわせてshell.cssの.mll-qoverlay--fixed/--inlineのtransform-origin二重定義を削除した(呼び出し側がpopoverScale({origin})で指定しており、variantがinitial/animate/exit全フェーズでインラインstyleに設定するためCSS側は常に上書きされる残骸だった)。
<!-- SECTION:FINAL_SUMMARY:END -->
