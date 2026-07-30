---
id: TASK-146
title: スマートフォルダー表示中のソートメニューを無効化またはフォルダー定義のソート表示に置き換える
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:34'
updated_date: '2026-07-30 16:30'
labels: []
dependencies: []
priority: low
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマートフォルダー表示中も汎用の並び替えメニューが有効なまま表示され、操作しても並びは変わらずスクロール位置だけリセットされる（敵対的検証で影響評価を補正・Codexレビュー指摘#21のPARTIAL確定版）。

事実:
- スマートフォルダーのソートはフォルダー定義自身が持つ仕様（shared/src/library.ts:91,117 の sortId、server/src/core/smartFolder.ts:62-68 が folder.sort を使用）。クライアントからのsort上書きを受け付けないAPI形状は意図的で、クエリ配線のバグではない
- 一方 client/src/app/ui/AddressBar.tsx:53 は mode==="library" でのみ分岐し、smart folder軸での無効化がない。LibrarySortMenu.tsx は global sort を更新するが useLibraryQueries.ts:89-100 の smartWorksQuery はsortを渡さないため無反応

方向: スマートフォルダー表示中はソートメニューを無効化/非表示にするか、フォルダー定義のソートを表示して編集導線（スマートフォルダーエディタ）へ誘導する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダー表示中に無効なソート操作ができない（無効化・非表示・またはフォルダーソートの表示に置換）
- [x] #2 通常ライブラリ表示のソート操作は現状どおり動く
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. スマートフォルダー軸ではソートメニューを無効化しフォルダー定義ソートを表示
2. 通常表示のソート操作は不変
3. pnpm --filter client check + pnpm test:client
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。スマートフォルダー軸ではメニューをdisabledにし、フォルダー定義ソートのラベルをツールチップ表示。client check+test:client 392件+fmt:check通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スマートフォルダー表示中は無効なソートメニューを無効化し、フォルダー定義の並び順を表示するようにした。
<!-- SECTION:FINAL_SUMMARY:END -->
