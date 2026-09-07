---
id: TASK-428.19
title: 未登録スキャン候補のタイトルとRJコード編集を安全にする
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - scan
  - editing
dependencies:
  - TASK-428.13
modified_files:
  - client/src/features/scan/ui/scanModal/UnregisteredTab.tsx
parent_task_id: TASK-428
priority: medium
ordinal: 446000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VIS-10、scan-dlsite-A-09/A-10とB重複。一括登録前に推定タイトルを直せず、RJコードのEscape・invalid入力で編集状態を失う。候補行の編集状態と登録可否を共通化する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 未登録候補のタイトルを編集・取消でき、登録payloadと登録後タイトルへ反映される
- [x] #2 RJコード編集のEscapeはmodalを閉じず編集を取消する
- [x] #3 不正値では値・focus・編集状態を保持して理由を表示する
- [x] #4 エラー行があっても正常行だけを選んで登録できる
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
