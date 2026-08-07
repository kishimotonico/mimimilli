---
id: TASK-235
title: 値行のlistbox/optionパターンをやめ、行内に複数操作を置ける構造にする
status: To Do
assignee: []
created_date: '2026-08-07 13:21'
labels: []
dependencies: []
ordinal: 245000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
値一覧（AxisValueRows.tsx / AxisValueGrid.tsx）とクイックオーバーレイ（AxisValueQuickList.tsx）の値行は role=listbox > role=option の div の中に、主選択ボタンと AND追加ボタンという2つのフォーカス可能要素を内包している。ARIAのoption roleは本来テキスト相当の内容を想定しており、フォーカス可能な子孫を複数持つ構成は listbox のキーボード規則と競合する。実際にフォーカスされるのは内側のボタンなのに role=option と aria-selected はフォーカスされない親要素にあるため、選択状態が正しく通知されない。現状は oxlint の disable コメントで逸脱を記述してごまかしている。

行内に複数の操作がある時点で listbox パターンは適合しないため、パターン自体をやめる。値行は role=option を持たない通常のリスト構造とし、選択状態は主選択ボタン自身が aria-pressed で表す。矢印キーによる行移動（focusRowAfterRender、data-quicklist-item / 値一覧側の相当実装）は現状の操作感を維持する。対象は AxisValueQuickList・AxisValueRows・AxisValueGrid の3箇所すべてで、構造を揃える。oxlint の disable コメントは不要になるため削除する。

置き換え後の構造規約は docs/design-system.md に記す。DRAFT-51 の内容を本タスクへ引き継ぐ（同ドラフトは archive する）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 値行が role=listbox / role=option を使わない構造になっている（3コンポーネントすべて）
- [ ] #2 選択状態が実際にフォーカスされる要素（主選択ボタン）の aria-pressed で表現されている
- [ ] #3 矢印キーでの行移動・Enter/Spaceでの選択・追加ボタンへの到達が従来どおり動作する
- [ ] #4 role/option 関連の oxlint disable コメントが不要になり削除されている
- [ ] #5 docs/design-system.md に値行の構造規約が記載されている
- [ ] #6 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
