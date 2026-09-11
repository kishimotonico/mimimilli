---
id: TASK-447.18
title: Filesのプレビュー幅の上限を利用可能な幅から決める
status: To Do
assignee: []
created_date: '2026-09-11 05:35'
labels:
  - bug
  - ui
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 486000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー第2回（tmp/uiux-triage-2026-09-11/followup-2.md の D）。useFilePreviewResize.ts の clamp が固定 720px 上限のため、広い画面で 720 を保存した後、レイアウト幅 721〜979px では一覧の最小幅 260px と同居できず横にあふれる。ドラッグ時・復元時の上限をコンテナ幅から一覧の最小幅を引いた値にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ドラッグ時と保存値の復元時に、プレビュー幅の上限がコンテナ幅から一覧の最小幅を引いた値で制限される
- [ ] #2 720px を保存した状態でウィンドウ幅を 800〜980px にしても、一覧が最小幅を保ちページが横にあふれない（実機で数値確認）
- [ ] #3 コンテナ幅の変化（ウィンドウリサイズ）にも追従する
- [ ] #4 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->
