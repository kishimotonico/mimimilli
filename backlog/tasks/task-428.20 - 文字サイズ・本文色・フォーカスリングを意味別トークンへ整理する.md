---
id: TASK-428.20
title: 文字サイズ・本文色・フォーカスリングを意味別トークンへ整理する
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - design-system
  - accessibility
dependencies: []
modified_files:
  - client/src/styles/tokens.css
  - docs/design-system.md
parent_task_id: TASK-428
priority: medium
ordinal: 447000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VIS-01/VIS-02、responsive-keyboard-A-08/A-09。生font-size、本文へのink-3、操作ごとの異なるfocus表示を用途別トークンに集約する。カテゴリ色は通常・hover背景の双方で読みやすくする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 主要本文・secondary・caption・control・label・monoが用途別font/line-height tokenを使う
- [x] #2 本文相当へink-3を使わずplaceholder・装飾用途に限定する
- [x] #3 カテゴリ色が通常・hover背景で4.5:1以上のコントラストを持つ
- [x] #4 操作部品のfocus-visibleが共通リングを使いoverflowで欠けない
- [x] #5 design-system更新とpnpm test:smokeに新規失敗がない
<!-- AC:END -->
