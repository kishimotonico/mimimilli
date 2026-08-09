---
id: TASK-282
title: レイヤ境界をlintで固定する（client feature間・server層方向）
status: To Do
assignee: []
created_date: '2026-08-09 00:32'
labels: []
dependencies:
  - TASK-259
  - TASK-264
  - TASK-265
priority: medium
ordinal: 292000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビューで検出、Sonnet検証済みの未起票課題。TASK-259・264・265で境界違反を解消しても、現行の .oxlintrc.json:18-47 の no-restricted-imports は App.tsx 向けoverride一つだけで再発を防げない（feature間sibling import・feature→app・serverの層方向の制約が皆無）。
- client: features間のsibling import禁止、features→app のimport禁止（entities・sharedへの依存は許可）
- server: routes→adapters/real 直接依存の禁止、adapters→routes の禁止など、ARCHITECTURE.md の層方向をルール化する
- oxlintのoverrides[].filesは複数セグメントパスがsilent無効化される既知の罠があるため、**/形式で書き、意図的に違反を作って検知することを確認してから導入する
- 実施はTASK-259・264・265の境界解消が済んでから（現状違反が残っているとlintが通らない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 client/serverの境界ルールがlint（または境界テスト）として存在し、違反を作ると検知されることが確認されていること
- [ ] #2 既存コードがルールに適合しCIレスでも pnpm check で検証されること
<!-- AC:END -->
