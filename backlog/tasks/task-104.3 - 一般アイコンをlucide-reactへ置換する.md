---
id: TASK-104.3
title: 一般アイコンをlucide-reactへ置換する
status: To Do
assignee: []
created_date: '2026-07-26 13:48'
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
- [ ] #1 lucide-react が client/package.json の dependencies にある
- [ ] #2 I の一般アイコンが Lucide 由来のコンポーネントを返す
- [ ] #3 アダプタが aria-hidden と currentColor を固定して出力する
- [ ] #4 Lucide の import が client/src/shared/ui 配下に閉じている
- [ ] #5 ブックマーク状態の塗り表現が現状と同じ見た目で機能する
<!-- AC:END -->
