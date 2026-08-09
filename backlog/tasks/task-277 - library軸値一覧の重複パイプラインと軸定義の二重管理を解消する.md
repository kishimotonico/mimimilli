---
id: TASK-277
title: libraryビュー軸定義の二重管理と軸値ソート仕様を確定する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 01:32'
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
- [ ] #1 ビュー軸定義が axisDefinitions の1箇所になっていること
- [ ] #2 オーバーレイのソート仕様が決定・実装されていること
- [ ] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-273（ADR適合監査）からの統合: サーバーとクライアントで軸値の順序規則が食い違っている。サーバー（core/axisFacets.ts:73-78）は count降順 → compareJapaneseSortKeys → compareUtf8Bytes で並べるが、クライアント（features/library/model/axisValueSort.ts:62,68）は名前ソート時も件数・時間ソートの同順位タイブレーカーでも localeCompare("ja") を使っている。件数が同数のタグが並ぶ場面は普通に起きるため実害がある。ADR-0008は「日本語向けの事前計算キーを使う」「localeCompare("ja")はこの規則へ置き換える」と決めており逸脱にあたる。軸値ソート仕様の確定と併せて、client側をcoreの規則へ揃えるか、サーバーの順序をそのまま使う設計にするかを決めること。draft-49（読み仮名）とも隣接。
<!-- SECTION:NOTES:END -->
