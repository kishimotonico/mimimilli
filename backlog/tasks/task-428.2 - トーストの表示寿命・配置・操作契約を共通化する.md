---
id: TASK-428.2
title: トーストの表示寿命・配置・操作契約を共通化する
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - ux
  - feedback
dependencies: []
modified_files:
  - client/src/shared/ui/Toast.tsx
  - client/src/app/ui/GlobalToast.tsx
parent_task_id: TASK-428
priority: high
ordinal: 429000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scan-dlsite-A/B-02/03、states-feedback-A-01/A-02等。操作結果のトーストが残り続け、dialog表示中に操作できない経路がある。成功・警告・失敗、表示先、寿命を共有Toastの契約として定義する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 通常通知は5秒、action付きは10秒を既定としhover/focus中は消去を止める
- [x] #2 エラーと継続操作が必要な通知は手動で閉じられる
- [x] #3 dialog内通知はdialog内、全体通知はviewport上端中央に表示され操作を遮らない
- [x] #4 成功・警告・失敗が視覚と文言で区別できる
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
