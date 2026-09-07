---
id: TASK-428.5
title: エラー作品とファイル欠損作品の表示・復旧導線を統一する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 15:54'
labels:
  - ui
  - ux
  - error-state
dependencies: []
references:
  - settings-setup-errors-A-07（tmp/uiux-audit-2026-09-04/findings-digest.md）
modified_files:
  - client/src/entities/work/workStatusLabel.ts
  - client/src/entities/file-system/model/navigationAtoms.ts
  - client/src/app/App.tsx
  - client/src/features/library/ui/WorkRow.tsx
  - client/src/features/library/ui/WorkTile.tsx
  - client/src/features/library/ui/WorkGrid.tsx
  - client/src/features/library/ui/WorkListPane.tsx
  - client/src/features/library/ui/LibraryView.tsx
  - client/src/features/library/ui/ErrorViewBulkUnregisterBanner.tsx
  - client/src/features/library/ui/preview/WorkDetail.tsx
  - client/src/features/library/ui/preview/WorkInfoDialog.tsx
  - client/src/features/library/ui/preview/WorkStatusWarnings.tsx
  - client/src/features/library/model/useLibraryQueries.ts
  - client/src/styles/shell/library-c.css
  - client/tests/unit/WorkStatusWarnings.test.tsx
parent_task_id: TASK-428
priority: high
ordinal: 432000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib-browse-A-01、settings-setup-errors-A/B-03/06/07等。同じ作品状態がgrid/list/detailで異なり、グリッドでは異常が分からず、詳細から復旧できない。状態名と登録解除の意味も統一する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 grid・list・preview・詳細・軸でファイル欠損とメタデータ読み込みエラーを同じラベルで表示する
- [x] #2 グリッドでも警告アイコンと説明titleから状態が分かる
- [x] #3 エラー詳細にフォルダーを開く・ライブラリ登録を解除する導線がある
- [x] #4 登録解除の確認に対象件数・削除範囲・再スキャン時の扱いを明記する
- [x] #5 pnpm test:smokeに新規失敗がない
- [x] #6 エラービュー内で操作名が「登録解除」に統一され、「削除」は物理ファイルの説明にしか現れない（rg で確認）
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-428.5フォローアップ: settings-setup-errors-A-07（欠損作品一括処理の用語揺れ）に対応。ErrorViewBulkDeleteBanner→ErrorViewBulkUnregisterBannerへ改名し、エラービュー内の操作名を「登録解除」に統一。「削除」は物理ファイルの説明にのみ残す。
<!-- SECTION:NOTES:END -->
