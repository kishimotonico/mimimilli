---
id: TASK-13
title: スマートフォルダー条件エディタの実装
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 10:24'
labels:
  - feature
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマートフォルダーの新規作成はwindow.promptで名前のみを入力する暫定実装で、ruleは空配列（rules: []）で固定されている。条件（フィールド/演算子/値）を設定できるエディタUIがない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダー作成/編集画面で条件（フィールド・演算子・値）を追加・削除できるUIを提供する
- [x] #2 複数条件のAND/OR組み合わせに対応する
- [x] #3 window.promptによる名前のみの暫定作成フローを置き換える
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex実装、Fable検証。契約拡張: 条件間conjunctionにORを追加し、評価を左から順のAND=積/OR=和/AND NOT=差の集合演算に再実装（server/src/core/smartFolder.ts、テスト込み）。実機確認: モーダルで作成（バリデーション: 名前なし/タグ未選択でエラー表示）→新フォルダーへ自動遷移→「条件を編集」でOR→ANDに変更し3件→2件のマッチ数変化を確認。check・client 97件・server 93件・ビジュアル6件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
window.promptを廃止しモーダルの条件エディタ（フィールド/演算子/値、追加・削除、AND/OR/AND NOT）を実装。契約と評価ロジックもOR対応に拡張。
<!-- SECTION:FINAL_SUMMARY:END -->
