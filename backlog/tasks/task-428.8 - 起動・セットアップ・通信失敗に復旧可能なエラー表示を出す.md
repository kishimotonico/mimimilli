---
id: TASK-428.8
title: 起動・セットアップ・通信失敗に復旧可能なエラー表示を出す
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 15:42'
labels:
  - ui
  - ux
  - error-state
dependencies: []
modified_files:
  - client/src/shared/lib/formatUserError.ts
  - client/src/app/ui/StartupErrorScreen.tsx
  - client/src/features/setup/ui/SetupScreen.tsx
parent_task_id: TASK-428
priority: high
ordinal: 435000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
settings-setup-errors-A-08/A-09/B-11、states-feedback-A-03/A-04。Failed to fetch等の生メッセージが表示され、再試行中に文脈が消える。画面別のユーザー向け説明と再試行状態へ変換する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 通信不能時にサーバー起動確認と再試行を案内する日本語メッセージが出る
- [x] #2 技術詳細は通常表示から分離し、必要時だけ展開できる
- [x] #3 再試行中はボタン自身がdisabledになり再試行中と表示される
- [x] #4 起動・setup・root errorでブランドと操作文脈が維持される
- [ ] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
