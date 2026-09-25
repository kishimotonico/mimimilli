---
id: TASK-465
title: 作品変更mutationとキャッシュ更新の責務をwork-managementモジュールへ集約する
status: To Do
assignee: []
created_date: '2026-09-24 07:21'
updated_date: '2026-09-25 02:30'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 現状調査（2026-09-25、feat/astra-followupマージ後のmaster基準）

作品を変更するmutationの入口（13箇所）と成功後のキャッシュ操作:
- meta一括保存: useLibraryQueries.ts editMutation → patchWorkSource → source setQueryData + invalidateWorkViewQueries（呼び出し元 WorkEditDialog）
- bookmark: useLibraryQueries.ts bookmarkMutation → patchWorkBookmark → applyBookmarkToWorkCache + applyBookmarkListCaches（workPatchInvalidation.ts。表示中軸がスマート/お気に入りならresetQueries、それ以外は一覧キャッシュを直接パッチ）
- 詳細ペインのタグ追加/削除: useLibraryQueries.ts addTag/removeTagMutation → source setQueryData + invalidateWorkViewQueries
- 登録解除(単体): useLibraryWorkDeleteMutation → deleteWork → WORK_QUERY_KEYS.all() invalidate + detail removeQueries
- 登録解除(missing一括): useLibraryBulkUnregisterMissingMutation → WORK_QUERY_KEYS.all()
- 登録解除(Files側)・ID再採番: files/ui/FilePreviewWorkActions.tsx → refreshFsState（FS系 + SCAN診断 + WORK all）
- 登録(候補一括): scan/ui/scanModal/UnregisteredTab.tsx → registerScanCandidates → scan/model/libraryInvalidation.ts
- 登録(Files単体ダイアログ): files/ui/RegisterWorkDialog.tsx はキャッシュ操作せず onRegistered で呼び出し元へ委譲
- DLsite単体適用/コード保存: library/ui/preview/DlsiteEditor.tsx → detail invalidate + entities/dlsite/useDlsiteInvalidation（jotai atom越しにfeatures/dlsiteのDlsiteBulkRuntimeが登録した関数を呼ぶ迂回）
- DLsite一括: features/dlsite/model/dlsiteInvalidation.ts（workIds指定でdetailの粒度を変える）
- インラインタイトル編集: scan/ui/scanModal/useInlineTitleEdit.ts → source setQueryData + detail invalidate + 呼び出し元指定key
- 再生開始時のsource投影(App.tsx handlePlay/handleResume)、SourceProjectionNotice → invalidateWorkViewQueries

query key root: WORK_QUERY_KEYS(works/work/axisFacets/dlsiteNotifications)、SMART_FOLDER・TAG・SCAN・FILE_SYSTEM・SETTINGS。作品変更は最大6系統をまたぐ。

layer境界: features間のsibling importは禁止、entities→features禁止。既存の無効化helperは「キー配列を返す純関数+実行wrapper」の形（scan/dlsite）と、画面のnavigation stateで分岐する手続き（workPatchInvalidation.ts）の2系統が混在。

配置候補の評価: entities/work/model が最も摩擦が小さい（既存 invalidateWorkViewQueries.ts と同格）。features/work-management 新設はsibling import禁止のためDLsiteと同じatom注入の迂回が要る。shared はドメイン非依存の性質と矛盾。

統括推奨（ADR起票時の叩き台）:
- 配置は entities/work/model（work-management相当）。DLsite一括の無効化は既存のentities/dlsite atom注入をそのまま使う。
- 操作ごと（meta編集/bookmark/タグ/登録/登録解除/再採番/DLsite適用）にmutation実行+必須無効化を1関数（hook）で提供する。無効化集合は操作ごとの関数で定義し、テーブル化はしない。
- 画面最適化は「必須無効化を満たした上で再取得を省略できる」オプション（例: activeListKeyと直接パッチ関数の注入）として画面側から渡す。共通モジュールはLibraryViewStateを参照しない。
- RegisterWorkDialogのような呼び出し元委譲も共通モジュールの登録mutationを直接使う形へ寄せる。
<!-- SECTION:NOTES:END -->
