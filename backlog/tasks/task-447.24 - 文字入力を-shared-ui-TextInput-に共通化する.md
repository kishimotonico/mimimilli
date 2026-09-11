---
id: TASK-447.24
title: 文字入力を shared/ui/TextInput に共通化する
status: To Do
assignee: []
created_date: '2026-09-11 08:18'
labels:
  - refactor
  - ui
  - triage
dependencies:
  - TASK-447.22
parent_task_id: TASK-447
priority: high
ordinal: 492000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
負債横断調査の反映 第4回（tmp/uiux-triage-2026-09-11/followup-4.md の1）。inputClass 系の文字列が RegisterWorkDialog・WorkEditDialog・DlsiteEditor・SmartFolderEditorModal・TagCombobox の5箇所に個別定義され、フォント・背景・disabled 対応が揺れている。shared/ui/TextInput.tsx（input の薄いラッパー、font と surface だけ props、他の属性は透過、forwardRef）に集約し、フォーカス表現もそこで1回だけ定義する。TASK-447.22 の取り込み後に着手する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shared/ui/TextInput.tsx があり、5箇所の文字入力（number 入力を含む）がこれを使い、inputClass 系の定数が残っていない
- [ ] #2 フォーカス時の境界線色の変化が TextInput の中で1回だけ定義され、design-system.md の「focus-visible:border-line-strong を併記する」規則が「文字入力は TextInput を使う」に置き換わっている。base.css の文字入力向け規則は TextInput に集約できた範囲で消えている
- [ ] #3 意図のある見た目の差（DlsiteEditor の mono 等）は props で残り、それ以外は揃っている。見た目が変わる箇所の before/after スクショが shots-intake にある
- [ ] #4 挙動は変わらず、既存テストの期待値を変えていない（変更したテストはタスクメモに列挙）。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
