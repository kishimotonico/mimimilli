---
id: TASK-277
title: libraryビュー軸定義の二重管理と軸値ソート仕様を確定する
status: Done
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 11:50'
labels: []
dependencies: []
priority: medium
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した library の axis-value 系の課題。Codexレビュー反映で範囲を縮小: 絞り込み→階層化→flatten のパイプライン共有と ResizeObserver 幅計測の共有は TASK-208（仮想化共通土台）のACと重複するため208へ一本化し、本タスクは軸定義と仕様確定だけを扱う。
- AxisColumn.tsx:28-35 と axisDefinitions.ts:12-21,73-83 でビュー軸の id/label/icon が二重定義 → axisDefinitions を正として buildViewAxisRows() を提供
- クイックオーバーレイのローカルsort state（AxisValueQuickList.tsx:131）とメイン値一覧の axisValueSortAtom の差、同一階層インデントの12px/14px差は、意図的仕様の可能性がある。統括と仕様を確定してから同期または明文化する（未決のまま実装に入らない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ビュー軸定義が axisDefinitions の1箇所になっていること
- [x] #2 オーバーレイのソート仕様が決定・実装されていること
- [x] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-273（ADR適合監査）からの統合: サーバーとクライアントで軸値の順序規則が食い違っている。サーバー（core/axisFacets.ts:73-78）は count降順 → compareJapaneseSortKeys → compareUtf8Bytes で並べるが、クライアント（features/library/model/axisValueSort.ts:62,68）は名前ソート時も件数・時間ソートの同順位タイブレーカーでも localeCompare("ja") を使っている。件数が同数のタグが並ぶ場面は普通に起きるため実害がある。ADR-0008は「日本語向けの事前計算キーを使う」「localeCompare("ja")はこの規則へ置き換える」と決めており逸脱にあたる。軸値ソート仕様の確定と併せて、client側をcoreの規則へ揃えるか、サーバーの順序をそのまま使う設計にするかを決めること。draft-49（読み仮名）とも隣接。

統括判断: クイックオーバーレイのソート状態は axisValueSortAtom へ共有する（軸値の並び順という同一のドメイン概念に2つの状態を持つのは重複であり、メイン一覧が既に「ソートメニュー・list列見出しの二重入口・単一state」という設計のため、オーバーレイを3つ目の入口として同じstateに載せるのが一貫する）。オーバーレイでソートを変えるとメインペインの並び順も変わる挙動変更を含む。インデントの12px/14px差は維持し、オーバーレイが横幅制約のあるポップオーバーで行高も独自定数を持つ密度の異なる表示であることを docs/design-system.md へ記載した。buildViewAxisRows() は VIEW_AXIS_IDS・VIEW_AXIS_LABELS・getAxisIcon() の既存定義を組み合わせるだけで新規定義を作っていない。レビューがsmoke1件の失敗を報告したが、統括が統合ブランチ（277なし）と本worktreeでA/B比較し、いずれも10件全パスを確認（本worktreeでは3回実行して3回とも全パス、3回目は31秒）。レビュー担当の環境は他タスクの実装・レビューが並行する高負荷下で、webServer冷起動レースによる既知のフレーキー（TASK-253へ記録）と判定。検証: pnpm check 成功、client 782テスト全パス、smoke 10件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ビュー軸の id/label/icon の二重定義を axisDefinitions の buildViewAxisRows() へ一本化し、クイックオーバーレイのソート状態を axisValueSortAtom へ共有した。インデント幅の差は表示密度の違いとして維持し理由を docs/design-system.md へ記載。pnpm check と client 782 テスト・smoke 10件で検証。
<!-- SECTION:FINAL_SUMMARY:END -->
