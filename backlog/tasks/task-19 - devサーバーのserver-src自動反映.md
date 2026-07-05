---
id: TASK-19
title: devサーバーのserver/src自動反映
status: To Do
assignee: []
created_date: '2026-07-05 17:59'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src配下の変更がvite devサーバーに自動反映されず、手動再起動が必要な状態が続いている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 vite.config等でserver workspaceをwatchし、変更検知時に自動でserverプロセスを再起動する仕組みを導入する
- [ ] #2 server/srcのファイルを変更した際、手動操作なしで変更が反映されることを確認する
<!-- AC:END -->
