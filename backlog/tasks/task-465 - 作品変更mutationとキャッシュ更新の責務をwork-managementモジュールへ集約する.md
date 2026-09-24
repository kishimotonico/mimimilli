---
id: TASK-465
title: 作品変更mutationとキャッシュ更新の責務をwork-managementモジュールへ集約する
status: To Do
assignee: []
created_date: '2026-09-24 07:21'
labels:
  - refactor
  - architecture
  - library
  - dlsite
  - scan
  - files
dependencies: []
priority: high
ordinal: 519000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/architecture-review-2026-09-20.md R2。Library/Files/Scan/DLsiteが、それぞれ作品を変更した後にどの一覧・詳細・件数を更新するかを個別に判断しており、作品管理の操作所有者が画面ごとに分散している。

現在のコード根拠（2026-09-24時点で確認済み）:
- client/src/features/library/model/useLibraryQueries.ts（applyPatchSuccess）
- client/src/features/library/ui/preview/WorkDetailPatchScope.tsx
- client/src/features/scan/model/libraryInvalidation.ts
- client/src/features/dlsite/model/dlsiteInvalidation.ts
- client/src/features/files/ui/FilePreviewWorkActions.tsx
- client/src/features/scan/ui/scanModal/useInlineTitleEdit.ts
- client/src/entities/work/queryKeys.ts

決定事項（統括判断、新しいADRに記録する）:
- meta編集、登録・登録解除、ID再採番、DLsite適用など作品を変更するmutationの入口と、操作ごとに必要なキャッシュ更新方針を、共通のwork-managementモジュールへ集める。
- 画面固有の選択解除・遷移・表示最適化（Libraryの表示中の軸・検索・ソートに応じた選択的patchや一覧resetなど）は各画面側に残す。ただし共通モジュールが定める更新方針を満たした上で再取得を省略する契約にする。
- 共通モジュールはLibraryのnavigation型を参照しない構造にする。

範囲外: DLsiteの取得ジョブ・SSEの寿命管理（TASK-448.3が別途担当）、query keyの全面階層再設計そのもの（既存のqueryKeys.tsを活用）。

TASK-448.1（WorkGrid/WorkListPane props整理）・TASK-448.2（LibraryView分割）は、本タスクが作る共通モジュールを前提に設計し直す必要があるため、本タスクを先行させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新しいADRとして、work-managementモジュールの責務範囲(何を集約し何を画面側に残すか)・配置・Libraryのnavigation型を参照しない制約を記録している
- [ ] #2 meta編集・登録・登録解除・ID再採番・DLsite適用のmutation呼び出しとキャッシュ更新方針が共通モジュールに集約されている
- [ ] #3 Library/Files/Scan/DLsiteの各画面はこの共通モジュールを経由し、無効化対象の集合を画面側が個別に知らなくてよい
- [ ] #4 画面固有の選択的patch・一覧resetなど表示最適化は、共通の更新方針を満たした上で画面側に残っている
- [ ] #5 作品編集・登録・登録解除・DLsite適用後の一覧/詳細/facet反映を縛るテストが追加され、既存のLibrary/Files/Scan/DLsite関連テストが通る
- [ ] #6 pnpm check && pnpm test が通る
<!-- AC:END -->
