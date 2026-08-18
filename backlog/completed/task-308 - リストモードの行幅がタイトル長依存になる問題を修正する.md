---
id: TASK-308
title: リストモードの行幅がタイトル長依存になる問題を修正する
status: Done
assignee: []
created_date: '2026-08-12 08:37'
updated_date: '2026-08-12 08:50'
labels: []
dependencies: []
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品一覧のリストモードで、タイトルが短い作品と1行に収まらない長い作品とで行要素の幅が変わる。行は <button className="mll-wrow">（client/src/features/library/ui/WorkRow.tsx:41）で、.mll-wrow（client/src/styles/shell/library-d.css:136-149）に width:100% がないためボタンが shrink-to-fit になり、white-space:nowrap のタイトル長がそのまま intrinsic 幅になる。仮想リストのラッパーdiv（client/src/shared/ui/useVirtualList.ts:112-119）は width:100% 済みで、抜けているのは行ボタン本体のみ。値一覧の行 .mll-vrow__main（library-d.css:554-566）が width:100% 明示済みの正解パターンなので、それに揃える。あわせて同型の罠を持つファイルモード行 .mle-row（client/src/styles/shell/files-a.css:9-19）とプレビューのトラック行 .mle-prv__trk（client/src/styles/shell/preview-a.css:367-376）も予防的に揃える。.mll-vrow-heading / .mll-qlist__heading は div なので対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 リストモードで短/長タイトルが混在しても全行の幅とhover領域がコンテナ幅100%で揃う
- [x] #2 長タイトルはellipsisで省略され、リスト領域に横スクロールが発生しない
- [x] #3 再生中表示・お気に入り表示ありの行でも列レイアウトが崩れない
- [x] #4 .mle-row と .mle-prv__trk も同様に全幅指定へ揃え、既存の見た目が変わらない
- [x] #5 TSXから未使用のCSS定義 .mll-erow / .mll-tagrow を削除する
- [x] #6 pnpm test:smoke がパスする
- [x] #7 pnpm check && pnpm test がパスする
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
検証: リストモードで短/長タイトル混在11件の .mll-wrow 幅が全行1024px（コンテナ幅一致）であることをDOM計測で確認。hover領域も同幅、横スクロールなし、再生中バッジ/お気に入り表示ありの行でも列崩れなし。ファイルモード行21件・プレビューのトラック行も同様に統一を確認。pnpm test:smoke 10 passed、pnpm check 全通過、pnpm test 全パス（fail 0）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
行ボタン .mll-wrow が shrink-to-fit のためタイトル長が行幅になっていた問題を、.mll-vrow__main に揃えて width:100%; min-width:0 を指定して解消。同型の .mle-row / .mle-prv__trk も予防的に揃え、TSXから未使用だった .mll-erow / .mll-tagrow のCSSとファイルヘッダーの所有範囲記述を削除。smoke・check・testで検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
