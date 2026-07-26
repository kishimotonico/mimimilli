---
id: TASK-104.3
title: 一般アイコンをlucide-reactへ置換する
status: Done
assignee:
  - '@cursor'
created_date: '2026-07-26 13:48'
updated_date: '2026-07-26 14:11'
labels: []
dependencies:
  - TASK-104.1
parent_task_id: TASK-104
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lucide-react を client の依存に追加し、I の中身を Lucide 由来のコンポーネントへ差し替える。アダプタ関数で aria-hidden・currentColor・size・strokeWidth を固定し、Lucide 固有の props を呼び出し側へ漏らさない。製品固有アイコンは自作を維持する。塗り表現(play/pause/prev/next/more/starF/gridJustified)は Lucide のパスに fill を与えるか自作を残すかを個別に判断する。WorkMetadataActions.tsx の [&_svg]:fill-current は Lucide の描画構造に合わせて見直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lucide-react が client/package.json の dependencies にある
- [x] #2 I の一般アイコンが Lucide 由来のコンポーネントを返す
- [x] #3 アダプタが aria-hidden と currentColor を固定して出力する
- [x] #4 Lucide の import が client/src/shared/ui 配下に閉じている
- [x] #5 ブックマーク状態の塗り表現が現状と同じ見た目で機能する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lucide-react を client の dependencies に追加する
2. Icon.tsx にアダプタ関数を作り、aria-hidden・currentColor・strokeWidth 1.5・size を固定する
3. 47個のキーを維持したまま、一般アイコンの実装を Lucide 由来に差し替える
4. 製品固有アイコン(ratio11・gridJustified・loopOne・swapLR)は自作のまま残す
5. 塗り表現(play・pause・prev・next・more・starF)は Lucide に fill を与えるか自作を残すか個別判断する
6. WorkMetadataActions.tsx の [&_svg]:fill-current を Lucide の描画構造に合わせて見直す
7. pnpm check と pnpm test を通す
8. 9〜13px での視認性は統括担当が実機で確認する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursorが実装、統括担当がレビューして3点差し戻し(WorkMetadataActions の不要な !important、fs/minimize が Maximize2/Minimize2 で原版の四隅ブラケットと意匠不一致)。修正後 6f58e1e でコミット。lucide-react 1.26.0。
<!-- SECTION:NOTES:END -->
