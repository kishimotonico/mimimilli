---
id: TASK-428.4
title: スキャンとDLsite取得の進行・完了・要対応状態を統一する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 14:45'
labels:
  - ui
  - ux
  - scan
  - dlsite
dependencies:
  - TASK-428.2
modified_files:
  - client/src/features/scan/ui/ScanRuntime.tsx
  - client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx
  - client/src/app/ui/NotificationBell.tsx
parent_task_id: TASK-428
priority: high
ordinal: 431000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scan-dlsite-A-01/A-04/A-05/A-06およびB重複。存在しないDLsiteジョブがactiveになり、通知ベルと要対応タブの件数定義も異なる。ジョブ実在確認、完了通知、問題単位の集計と解決導線を一つの状態モデルにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsiteジョブがない場合は進捗・中止操作を表示せず、running/cancellingだけをactive表示する
- [x] #2 モーダル外で完了・中止を1回通知し、登録数・新規数・エラー数・欠損数を表示する
- [x] #3 通知ベルと要対応タブが同じ問題一覧と件数を使う
- [x] #4 ID重複はworkId単位1行で全パスと解決導線を示す
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
