---
id: TASK-428.13
title: グローバルショートカットとEscapeの有効範囲を制御する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 13:06'
labels:
  - ui
  - keyboard
  - player
dependencies: []
modified_files:
  - client/src/features/player/model/useGlobalShortcuts.ts
  - client/src/shared/ui/TagCombobox.tsx
parent_task_id: TASK-428
priority: high
ordinal: 440000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
responsive-keyboard-A-03/A-04/A-07、interaction-model-A-05。dialog内でもSpaceや矢印が背後の再生を操作し、TagComboboxが閉じた状態でもEscapeを奪う。レイヤー順に一段だけ閉じる契約へ揃える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dialog・popover内でSpaceと左右キーが背後の再生やseekを変えない
- [x] #2 候補表示中のEscapeは候補だけを閉じる
- [x] #3 候補が閉じている時のEscapeは編集またはdialogへ伝わる
- [x] #4 input・slider・menuのネイティブ操作を壊さない
- [ ] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
