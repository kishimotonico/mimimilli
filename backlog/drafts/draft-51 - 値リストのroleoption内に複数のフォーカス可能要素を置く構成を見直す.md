---
id: DRAFT-51
title: 値リストのrole=option内に複数のフォーカス可能要素を置く構成を見直す
status: Draft
assignee: []
created_date: '2026-08-07 12:39'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
値一覧（AxisValueRows.tsx / AxisValueGrid.tsx）とクイックオーバーレイ（AxisValueQuickList.tsx、TASK-231で追随）の値行は、role=listbox > role=option の div の中に主選択ボタンとAND追加ボタンという2つのフォーカス可能要素を内包している。ARIAのoption roleは本来テキスト相当の内容を想定しており、フォーカス可能な子孫を複数持つ構成は読み上げ・操作が不安定になりやすい既知のアンチパターン。現状はoxlintのdisableコメントで意図的な逸脱として記述されているが、スクリーンリーダーでの実挙動の検証や代替案（listbox+optionをやめてgrid/toolbarパターンにする、AND追加を行内ボタンではなく別の操作に寄せる等）の検討は行われていない。要件が未確定のためドラフト。着手するならまず現状のSR実挙動の確認と方針決定から。
<!-- SECTION:DESCRIPTION:END -->
