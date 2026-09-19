---
id: TASK-428.15
title: ライブラリの検索・パンくず・不正URLからの復帰を整える
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - navigation
  - library
dependencies: []
modified_files:
  - client/src/app/ui/TopBar.tsx
  - client/src/features/library/ui/LibraryBreadcrumbs.tsx
  - client/src/features/library/model/navigationUrl.ts
parent_task_id: TASK-428
priority: high
ordinal: 442000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib-browse-A-07〜09/A-11、work-detail-A-10/A-15。検索とEscape、スマートフォルダー名、不正軸URL、プレビューの閉じ方が別々の規約になっている。履歴と内側レイヤーを壊さず復帰できるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 検索Escapeは値クリア、空ならblurと直前focus復帰の順で動く
- [x] #2 作品詳細でも検索を利用でき、確定後は検索結果へ移る
- [x] #3 スマートフォルダーのパンくずに対象名が表示される
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 未登録軸URLと存在しないスマートフォルダーIDのURLを0件の偽ページにせず、警告付きで既定一覧へ戻す
<!-- AC:END -->
