---
id: TASK-114
title: ContentColumnを軸モードごとに分割する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-27 01:57'
updated_date: '2026-07-31 02:34'
labels:
  - client
  - refactor
dependencies: []
priority: medium
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ContentColumn.tsx（338行 / 21 props）が、タグ軸UI・ファセット軸UI・作品一覧という排他的な3モードを1ファイルに抱えている。軸ごとに使われない props が混在しており、インターフェース分離の観点で分けるべき。

加えて、作品一覧用の useVirtualizer が早期 return より前（ContentColumn.tsx:81 付近）にあるため、タグ・ファセット表示でも毎回生成されている。

方針:
- タグ / ファセット / 作品一覧を別コンポーネントに分ける。必ずしも3ファイルに分割する必要はなく、内部コンポーネント + 判別可能ユニオンでもよい
- virtualizer は作品一覧のコンポーネントだけが持つ
- タグ・ファセットの一覧が非仮想化の全件 map になっている点は、件数の実測を踏まえて別途判断する（このタスクでは仮想化しない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タグ軸・ファセット軸・作品一覧が別コンポーネントに分かれ、各コンポーネントが自分のモードで使う props だけを受け取る
- [x] #2 タグ軸・ファセット軸の表示時に作品一覧用の virtualizer が生成されない
- [x] #3 3モードそれぞれの表示・選択・ドリルダウン・追加読み込みが従来どおり動作する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ContentColumnをタグ/ファセット/作品一覧の内部コンポーネント+判別ユニオンへ分割
2. virtualizerは作品一覧のみ生成
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codexレビュー2件: タグ/ファセット一覧のworksQueryKey変更時スクロールリセット退行は修正。同一query keyのモード切替でのスクロール保持喪失は、従来挙動が同一DOM再利用の副産物でありモード切替で先頭に戻る方が予測可能なため意図した仕様変更として採用（統括判断）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ContentColumnをTagAxisContent/FacetAxisContent/WorksListContent+ルーターへ分割、virtualizer/listRef/MutationObserverは作品一覧のみ。452テスト・ビジュアル6/6・pnpm check通過。実装Cursor委譲、Codexレビュー2件対応。
<!-- SECTION:FINAL_SUMMARY:END -->
