---
id: TASK-18
title: ダークテーマでの新コンポーネント確認
status: Done
assignee:
  - '@claude'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-06 03:21'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
  - docs/design-system.md
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ダークテーマ（.ml-dark）で新しく追加されたコンポーネント（Button/IconButton/TagCombobox）の見た目が未確認。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ダークテーマ切り替え時にButton/IconButton/TagComboboxの配色・コントラストが設計通りであることを確認する
- [x] #2 問題があれば該当コンポーネントのダークテーマ用スタイルを修正する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. agent-browserでダークテーマに切替え、Button/IconButton/TagComboboxの表示を確認
2. ライト/ダーク両方でスクリーンショット比較、コントラスト・トークン準拠をチェック
3. 問題があれば修正（実施はClaude自身）
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
agent-browserで.ml-darkを付与して確認（テーマ切替UIは未実装のためJSでクラス付与）。

- Button（primary/secondary/ghost）・IconButton・TagCombobox（入力欄+候補listbox）ともダークで正常表示。全てセマンティックトークン（paper/ink/acc系）で構成されておりテーマ追従に問題なし
- 候補listboxが縮小スクショで白背景に見えたため精査したが、ピクセル値検証（rgb(21,17,12)≒paper-1ダーク値）で正常と確認。誤検知だった
- 修正が必要な問題は見つからなかったためコード変更なし
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ダークテーマでButton/IconButton/TagComboboxを目視+計算スタイル+ピクセル値で検証、配色・コントラストとも問題なし。修正不要と判断
<!-- SECTION:FINAL_SUMMARY:END -->
