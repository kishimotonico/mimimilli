---
id: TASK-465
title: 作品変更mutationとキャッシュ更新の責務をwork-managementモジュールへ集約する
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:21'
updated_date: '2026-09-25 03:52'
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
- [x] #1 新しいADRとして、work-managementモジュールの責務範囲(何を集約し何を画面側に残すか)・配置・Libraryのnavigation型を参照しない制約を記録している
- [x] #2 meta編集・登録・登録解除・ID再採番・DLsite適用のmutation呼び出しとキャッシュ更新方針が共通モジュールに集約されている
- [x] #3 Library/Files/Scan/DLsiteの各画面はこの共通モジュールを経由し、無効化対象の集合を画面側が個別に知らなくてよい
- [x] #4 画面固有の選択的patch・一覧resetなど表示最適化は、共通の更新方針を満たした上で画面側に残っている
- [x] #5 作品編集・登録・登録解除・DLsite適用後の一覧/詳細/facet反映を縛るテストが追加され、既存のLibrary/Files/Scan/DLsite関連テストが通る
- [x] #6 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
ADR: docs/adr/0028-work-management-mutation-ownership.md（worktree task/465）

1. entities/work/api.ts へ変更APIを移す: createWork・reassignIdentityConflict（features/files/api.ts から）、registerScanCandidates（features/scan/api.ts から）。呼び出し元のimportを更新する
2. entities/work/model/workCacheUpdates.ts を新設: ADRの操作ごとの必須更新関数（updateCachesAfterSourceEdit / PlaybackPrepared / Bookmark / Registration / LibraryScan / Unregistration / IdentityReassign / DlsiteLinkageChange / DlsiteBulkApply / DlsiteBulkFetch）。entities/work/invalidateWorkViewQueries.ts を削除
3. entities/work/model/workMutations.ts を新設: ADRの公開hook一式。bookmarkは ActiveListCacheHandler を受け、引き受けたkeyだけ無効化から外す
4. 画面の付け替え
   - Library: useLibraryQueries.ts の editMutation/bookmark/タグ/削除/missing一括を共通hookへ。useLibraryWorkPatchMutations(nav, searchQuery) はLibrary側の合成として残し、nav から activeList（パッチ or reset）を作る。useLibraryWorkDeleteMutation・useLibraryBulkUnregisterMissingMutation は削除し呼び出し側が共通hook＋mutate単位のonSuccessへ。workPatchInvalidation.ts は smartOrWorksListKey と activeList 生成だけ残し、applyBookmarkToWorkCache は共通側へ。workPatchListCache.ts の staleInactiveListCaches と、未使用の patchWorkInQueryCache・workToListItem を削除（workPatchListCache.test.ts の該当ケースごと）
   - DlsiteEditor: 共通のDLsite hook群へ。useDlsiteInvalidation・dlsiteInvalidateAtom を削除
   - DLsite: DlsiteBulkRuntime は updateCachesAfterDlsiteBulkFetch、DlsiteBulkApplyRuntime は useApplyDlsiteMissingMutation。features/dlsite/model/dlsiteInvalidation.ts を削除
   - Scan: UnregisteredTab は useRegisterScanCandidatesMutation、ScanRuntime は updateCachesAfterLibraryScan（SETTINGS無効化と候補再取得は画面側に残す）、useInlineTitleEdit は useRenameWorkMutation（queryKey引数を削除）。features/scan/model/libraryInvalidation.ts を削除
   - Files: FilePreviewWorkActions の解除・再採番を共通hookへ。RegisterWorkDialog は useRegisterWorkMutation を直接使い、onRegistered は投影通知の表示だけに使う。refreshFsState は画面の表示中ディレクトリ再取得（onWorkRegistered）と既登録検知時の再読込だけに縮める
   - App.tsx handlePlay/handleResume は updateCachesAfterPlaybackPrepared、SourceProjectionNotice は useProjectWorkSourceMutation
5. テスト
   - 追加: tests/unit/workCacheUpdates.test.ts（QueryClientへ各キーを置き、meta編集・登録・登録解除（単体/一括）・ID再採番・DLsite単体/一括適用/一括取得・スキャン完了の後の書き戻し・無効化・削除を確認）、tests/unit/workMutations.test.tsx（bookmarkのactiveList契約: 引き受けたkeyは無効化されず他の一覧は無効化、未指定時は全一覧無効化。meta編集失敗時の詳細無効化）
   - 移設: libraryInvalidation.test.ts・dlsiteInvalidation.test.ts・workPatchInvalidation.test.ts の期待値（件数プレビュー無効化、workIds指定時の詳細粒度、空配列で詳細を触らない、sourceを残す、bookmarkでresumeを触らない）を新テストへ移して元ファイルを削除。workPatchListCache.test.ts の staleInactiveListCaches ケースは新テストへ移す
   - 既存 workPatchListSync・workPatchMutationScope・DlsiteEditor・RegisterWorkDialog・UnregisteredTab・ScanRuntime を通す
6. pnpm check && pnpm test をworktreeで1回
<!-- SECTION:PLAN:END -->

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

段階2実装（worktree task/465、2026-09-25）: entities/work/model/workMutations.ts・workCacheUpdates.ts を新設し Library/Files/Scan/DLsite/App を付け替え。旧helper（libraryInvalidation・dlsiteInvalidation・invalidateWorkViewQueries・useDlsiteInvalidation・dlsiteInvalidateAtom・staleInactiveListCaches・patchWorkInQueryCache・workToListItem・useLibraryWorkDeleteMutation・useLibraryBulkUnregisterMissingMutation）を削除。テスト追加: tests/unit/workCacheUpdates.test.ts・workMutations.test.tsx。worktreeで pnpm check && pnpm test 通過（client 155ファイル/1147件）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品変更のmutationと操作ごとの必須キャッシュ更新を client/src/entities/work/model（workMutations.ts / workCacheUpdates.ts）へ集約し、Library/Files/Scan/DLsite・App・SourceProjectionNoticeを経由させた（ADR-0028）。旧helper（scan libraryInvalidation、dlsite dlsiteInvalidation、invalidateWorkViewQueries、useDlsiteInvalidation/dlsiteInvalidateAtom 等）は削除。画面固有の最適化はbookmarkのActiveListCacheHandler注入として画面側に残した。検証: workCacheUpdates.test.ts・workMutations.test.tsx追加、pnpm check && pnpm test 緑、Sonnetレビューで報告外副作用なし。feat/work-management 94aee0bb。
<!-- SECTION:FINAL_SUMMARY:END -->
