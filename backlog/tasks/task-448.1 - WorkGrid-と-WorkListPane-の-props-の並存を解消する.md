---
id: TASK-448.1
title: WorkGrid と WorkListPane の props の並存を解消する
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-448
priority: medium
ordinal: 497000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkGrid.tsx と WorkListPane.tsx がそれぞれ21個の props をほぼ同じ構成で持ち、軸・選択状態・再生状態・ページング・スマートフォルダー系のハンドラーがフラットに並ぶ。呼び出し元（LibraryView）の変更が両方へ波及する。関心ごとにまとまった形（props のグループ化か、モデルフック・atom から読む形）に作り直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WorkGrid と WorkListPane の props が関心ごとにまとまり、同じフィールドを両方へ手渡しする構成が無くなっている
- [ ] #2 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
