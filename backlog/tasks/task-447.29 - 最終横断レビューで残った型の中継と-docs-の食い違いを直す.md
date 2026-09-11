---
id: TASK-447.29
title: 最終横断レビューで残った型の中継と docs の食い違いを直す
status: To Do
assignee: []
created_date: '2026-09-11 12:36'
labels:
  - refactor
  - docs
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 502000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
統合ブランチ全体の2回目の横断レビュー（fd07811）で残った3件。entities/dlsite/model/dlsiteNotificationModal.ts が shared の DlsiteNotificationModalKind を再 export する中継になっており、isDlsiteNotificationModal も3種のリテラルを重ねて書いている。docs/dlsite.md が computeMissingDiff の置き場所を adapter 側と書いている。docs/client-error-handling.md が削除済みの errorToastAtom を参照している。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DlsiteNotificationModalKind の再 export が消え、利用側は shared/model/activeModalAtom から直接読む。3種の値は shared の1か所（例: as const の配列から型を導出）にだけあり、isDlsiteNotificationModal もそれを使う
- [ ] #2 docs/dlsite.md の computeMissingDiff の置き場所が shared/src/dlsite.ts になっている（docs/HANDOFF.md の該当行も実態と食い違っていないか確認）
- [ ] #3 docs/client-error-handling.md のエラー表示の説明が、useToast に一本化した現在の実装（error は variant=error の要求、所有者ごとの経路）と一致し、削除済みの atom 名が残っていない
- [ ] #4 pnpm check・pnpm test が通る
<!-- AC:END -->
