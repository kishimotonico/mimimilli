---
id: TASK-274
title: shell.cssを面ごとのファイルへ分割する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
labels: []
dependencies: []
priority: medium
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/styles/shell.css が約3400行の単一CSSで、explorer系（mle-）とlibrary系（mll-）が混在し変更の影響範囲が読めない。explorer / library / player 等の面ごとに分割し、main.tsx から複数importする。見た目の変更はゼロが前提（純粋なファイル分割）。docs/design-system.md の規約に従うこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shell.css が面ごとの複数ファイルに分割され、クラスの定義先がプレフィックスから予測できること
- [ ] #2 全画面の見た目に変化がないこと（pnpm test:smoke で確認）
- [ ] #3 clientのcheckが通ること
<!-- AC:END -->
