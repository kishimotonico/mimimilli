---
id: TASK-447.27
title: fixture の経緯コメントと design-system.md の数値転記を削る
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
labels:
  - docs
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 495000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
負債横断調査の反映 第4回（tmp/uiux-triage-2026-09-11/followup-4.md の4）。server/src/adapters/fixture/state.ts の6行 JSDoc に経緯が残り、design-system.md の文字サイズトークン表とスケール外の現在値に tokens.css の数値が転記されている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server/src/adapters/fixture/state.ts の該当 JSDoc が1行になり、経緯が消えている
- [ ] #2 design-system.md の文字サイズトークン表から px・行高の数値列が消え、値は tokens.css を参照し用途の対応だけを記す形になっている。スケール外の現在値の個別 px 列挙が探し方1行に置き換わっている
- [ ] #3 design-system.md の「見送ったUI案」節の冒頭に「10件を上限とし、超えたら古いものから削る。復活提案が出なくなった案も削る」の運用ルールがある
- [ ] #4 pnpm check が通る
<!-- AC:END -->
