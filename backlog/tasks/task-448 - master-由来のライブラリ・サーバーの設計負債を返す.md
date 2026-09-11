---
id: TASK-448
title: master 由来のライブラリ・サーバーの設計負債を返す
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
labels:
  - refactor
  - triage
dependencies: []
priority: medium
ordinal: 496000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
feat/ui-ux-intake（TASK-447）の負債横断調査（2026-09-11）で見つかったもののうち、master に元からある大きい負債。ユーザー判断で TASK-447 のブランチでは直さず、master マージ後に別の統合ブランチで着手する。挙動は変えないリファクタとして進める。同じ時期に DRAFT-47（作品編集UIの保存モデル見直し）も別ブランチで着手する。調査メモの原本は tmp/uiux-triage-2026-09-11/debt-scan.md（2〜4・7・8節、gitignore 対象）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 子タスク4件がすべて完了している
<!-- AC:END -->
