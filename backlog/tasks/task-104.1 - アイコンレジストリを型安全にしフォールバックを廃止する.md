---
id: TASK-104.1
title: アイコンレジストリを型安全にしフォールバックを廃止する
status: To Do
assignee: []
created_date: '2026-07-26 13:48'
labels: []
dependencies: []
parent_task_id: TASK-104
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
I を as const 化して IconName = keyof typeof I を導出し、アイコン名を文字列で持っているマップを型付けする。これにより暗黙フォールバックが型的に不要になるので削除する。対象は client/src/shared/ui/Icon.tsx、client/src/features/files/model/types.ts の FILE_KIND_ICON、client/src/app/ui/LeftNav.tsx、client/src/features/library/ui/AxisColumn.tsx、client/src/features/files/ui/FilePreview.tsx、client/src/features/files/ui/FileRow.tsx。IconSet = I as Record<string, ...> というキャストも廃止する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IconName 型が I のキーから導出されている
- [ ] #2 FILE_KIND_ICON の値型が IconName であり string ではない
- [ ] #3 LeftNav と AxisColumn のアイコン指定が IconName で型付けされている
- [ ] #4 I as Record<string, ...> のキャストが存在しない
- [ ] #5 ?? I.folder / ?? I.file の5箇所が削除されている
<!-- AC:END -->
