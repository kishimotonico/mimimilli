---
id: TASK-428.22
title: 軸レールとスマートフォルダーの識別情報を補う
status: To Do
assignee: []
created_date: '2026-09-07 09:09'
updated_date: '2026-09-07 19:16'
labels:
  - ui
  - library
  - smart-folder
dependencies: []
modified_files:
  - client/src/features/library/ui/AxisColumn.tsx
  - client/src/entities/library/axisDefinitions.ts
parent_task_id: TASK-428
priority: medium
ordinal: 449000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VIS-09、smart-folders-A-07/A-08/A-18とB重複。軸レールに要件上の件数が配線されず、スマートフォルダー名・作成導線・アイコンも現在地を伝えない。既存集計経路から識別情報を渡す。

スマートフォルダー選択時のパンくずへの対象名表示は TASK-428.15 #3 に寄せ、本タスクでは扱わない（AC重複の整理）。

前提（統合済みの変更）: axisDefinitions.ts には TASK-428.7 が resolveTagPrefix 利用を、TASK-428.15 が isRegisteredFacetAxis（未登録軸URLの判定用、"year"は組み込みで常にtrue・それ以外は登録済みprefixのみ）を追加済み。件数の意味は TASK-428.14 が定義しており、「無条件集計」＝現在の選択タグを一切適用しないその値だけの件数（置き換え既定の入口で使う）と、選択タグ込みの集計（AND追加既定の入口で使う）を区別している。これは TASK-428.11 の「条件一致 N件」（スマートフォルダーのルール一致数）とは別概念。要対応の件数は TASK-428.4 が countNeedsAttention に集約済み（ID重複・読み取り失敗・データ不整合は問題1件=1、RJ未検出・DLsite取得/パース失敗は影響件数を加算）。AC#2「通常件数と要対応badgeを別の意味として併存させる」はこの2つの数え方の違いを踏まえること。TASK-432 が軸ファセットAPIにスマートフォルダー条件を持ち込む予定なので、GET /axes/:axis とサーバー側の評価経路には触れないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 全ビュー軸・分類軸・スマートフォルダーに正しい件数を表示する
- [x] #2 通常件数と要対応badgeを別の意味として併存させる
- [x] #3 192px幅で新規作成ラベルが省略されずプラス記号が重複しない
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 スマートフォルダー行のアイコンが「すべての作品」と異なる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
分類軸の件数は「値の個数」で確定（オーナー判断、ADR-0012準拠）。多値タグの重複排除集計API（軸配下の総作品数を正確に返す新規エンドポイント）は起票しない。理由: 1作品が同一軸内で複数値を持ちうる（例: 1作品に複数ジャンル・複数タグ）ため、既存のGET /axes/:axisが返す値ごとのcountを単純合算すると重複作品を二重計上し、「軸配下の総作品数」を正しく算出できない。正確な値を得るには作品ID集合のUNIONをサーバー側で計算する新規集計経路が必要になるが、値の個数（GET /axes/:axisの応答配列長、既存の無条件集計＝TASK-428.14と同じキャッシュキーで取得可能）で軸の規模感を伝えるという設計目的は既に満たしており、総作品数を要求する具体的な利用箇所も無いため、新規APIを起票する理由が無いと判断した。

単位の誤読防止: ビュー軸・スマートフォルダー行は作品数、分類軸・タグ軸・年軸は値の個数と、行によって件数の意味が異なる。軸行のtitle属性（分類軸のみ「値 N件」）とクイックオーバーレイ見出し（AxisValueQuickList、同じitems.lengthを表示）で単位を明示し、軸レール下部のライブラリ統計（作品数表記）との対比で誤解しないようにした。
<!-- SECTION:NOTES:END -->
