---
id: TASK-104.1
title: アイコンレジストリを型安全にしフォールバックを廃止する
status: Done
assignee:
  - '@cursor'
created_date: '2026-07-26 13:48'
updated_date: '2026-07-26 13:56'
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
- [x] #1 IconName 型が I のキーから導出されている
- [x] #2 FILE_KIND_ICON の値型が IconName であり string ではない
- [x] #3 LeftNav と AxisColumn のアイコン指定が IconName で型付けされている
- [x] #4 I as Record<string, ...> のキャストが存在しない
- [x] #5 ?? I.folder / ?? I.file の5箇所が削除されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Icon.tsx の I を as const 化し IconName = keyof typeof I を導出する
2. IconFC の型境界を維持したまま I の値型を IconFC に固定する
3. FILE_KIND_ICON の値型を string から IconName に変更する
4. LeftNav / AxisColumn のアイコン名指定を IconName で型付けする
5. IconSet = I as Record<string, ...> のキャストを4箇所削除する
6. 型で網羅性が保証された結果不要になる ?? I.folder / ?? I.file を5箇所削除する
7. pnpm check と pnpm test を通す
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(Composer 2.5)が実装、統括担当が差分レビューして 972efce 後続としてコミット。pnpm check / pnpm test ともに exit 0。PREFIX_ICONS の ?? "folder" は動的なタグprefixに対する既定値として意図的に残した。
<!-- SECTION:NOTES:END -->
