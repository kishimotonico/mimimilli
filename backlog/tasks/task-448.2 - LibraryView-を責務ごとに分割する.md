---
id: TASK-448.2
title: LibraryView を責務ごとに分割する
status: Done
assignee:
  - '@claude'
created_date: '2026-09-11 08:19'
updated_date: '2026-09-25 04:21'
labels:
  - refactor
  - triage
dependencies:
  - TASK-465
parent_task_id: TASK-448
priority: medium
ordinal: 498000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
LibraryView.tsx が約445行あり、ナビゲーション状態の解釈・クエリ・結果面の組み立て・プレビューの開閉・バナー等が1ファイルに同居している。ロジックはモデルフックへ、UI ブロックはサブコンポーネントへ分ける。

2026-09-24追記: TASK-465（作品変更mutationとキャッシュ更新の責務をwork-managementモジュールへ集約する、architecture-review-2026-09-20.md R2）を先に行う。本タスクのロジック（モデルフック）分割は、TASK-465が作る共通work-managementモジュールの呼び出し方に合わせて設計する。TASK-465完了前に着手する場合、キャッシュ更新ロジックの分割・移動は最小限にし、TASK-465完了後に共通モジュールへ差し替える前提で進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LibraryView の責務が分割され、各モジュールの責務がタスクメモに一覧されている
- [x] #2 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
方針: navigationの解釈（useLibraryNavigation・nav）はTASK-466で作り直される予定のため、
新しい抽象に包み直さずそのまま使う。分割は「LibraryViewに同居している責務を
質の違うモジュールへ出す」ことに限定する。

現状の責務（LibraryView.tsx、448.1適用後で約424行）:
1. 付随データ取得（useLibrarySupportingQueries・useMissingWorksCountQuery・
   useLibraryDebouncedSearchQuery）— 既にuseLibraryQueries.tsに分離済み、変更しない
2. スマートフォルダー編集: モーダルの開閉state・保存/削除mutation・保存後のnav.setAxis遷移
3. 選択解除の副作用: 検索/フィルタで0件になった時、選択中作品が404の時にnav.selectWork(null)
4. プレビュー再生系ハンドラー: handlePlay/handleResume/handleExpand/handleGoToPlayingScreen、
   playingWorkId/playingTrackIndex/isPlaybackActiveのatom購読
5. タグクリックハンドラー（nav.addTag/replaceTagの分岐、5行）
6. 表示導出: paneKind/showGrid（既にlibraryPresentation.tsの純関数、変更しない）・
   activeSmartFolderの算出
7. UI組み立て: AxisColumn・FilterChipBand・value-list分岐・LibraryWorksBoundary配下の
   結果面（バナー・WorkGrid/WorkListPane・workResultsProps組み立て・PreviewPaneSlide）・
   SmartFolderEditorModal配線

新設するmodel hook（client/src/features/library/model/）:
- useLibrarySmartFolderEditor(nav): 責務2を集約。SmartFolderEditorState・
  saveSmartFolderMutation・deleteSmartFolderMutation・open(new/edit)・closeを1つにまとめ、
  保存/削除成功時のnav.setAxis遷移もここに置く。戻り値
  { state, openNew, openEdit(folder), close, saveMutation, deleteMutation }。
- useLibrarySelectionCleanup({ nav, isNoResultsDueToFilter, workDetailError }): 責務3。
  戻り値なしの副作用専用hook（現状の2つのuseEffectをそのまま移す）。
- useLibraryPreviewActions({ selectedWork, rootFolder, onPlay, onResume, openWorkDetail, setAppMode }):
  責務4。playingWorkId/playingTrackIndex/isPlaybackActiveの購読とhandlePlay/handleResume/
  handleExpand/handleGoToPlayingScreenをまとめ、選択中作品が再生中かどうか
  （isSelectedWorkPlaying）とPreviewPaneSlide用のplayingTrackIndex（非選択中はnull）も
  ここで計算して返す。呼び出し元でのplayingWorkId比較の重複を無くす。

新設するUIサブコンポーネント（client/src/features/library/ui/）:
- PreviewPaneSlide.tsx: 現在LibraryView.tsx内のローカル関数をそのままファイル分割。
  motionラッパー1つのみで責務は変えない。
- LibraryResultsPane.tsx: 責務7のうちLibraryWorksBoundary配下（バナー・
  workResultsPropsの組み立て・WorkGrid/WorkListPaneの出し分け・PreviewPaneSlideの
  AnimatePresence）を1コンポーネントに集約する。448.1で作ったworkResultsPropsの組み立ても
  ここへ移す。props: nav, result, isPending, showGrid, dockedBarActive, activeSmartFolder,
  isErrorView, missingWorksCount, tagPrefixes, tagSuggestions, searchQuery, setSearchQuery,
  onEditSmartFolderRules, selectedWork, workDetailQuery, previewActions
  （useLibraryPreviewActionsの戻り値）, onTogglePlay, onPlay。
- SmartFolderEditorSection.tsx: 責務7のうちSmartFolderEditorModalの配線（エラー文言の
  組み立てを含む）をuseLibrarySmartFolderEditorの戻り値を受け取って描画する形に集約。

LibraryViewに残すもの:
- rootFolder・searchQuery/debouncedSearchQuery・viewMode・nav・
  useLibrarySupportingQueries・missingWorksCountQuery の呼び出しと、
  paneKind/showGrid/activeSmartFolderの算出（既存の純関数を使うだけ）
- 上記3つのhookの呼び出しと配線
- handleTagClick（5行、AxisColumn/FilterChipBand向けの小さな分岐のため独立hook化しない）
- JSX: AxisColumn・FilterChipBand・value-list分岐（短いためLibraryResultsPane化しない）・
  LibraryWorksBoundaryの children で LibraryResultsPane を呼ぶだけの形・
  SmartFolderEditorSectionの呼び出し

挙動は変えない。value-list分岐（AxisValueList）は短い（15行程度）ため独立コンポーネント化の
対象にしない。

影響確認済みのテスト: client/tests/unit/appBodyDockedBarWiring.test.tsx・
libraryAxisFacetSwitch.test.tsx・workPatchListSync.test.ts・scanModal.test.ts は
useLibraryQueries.tsの関数とWorkGrid/WorkListPaneをvi.mockしており、今回の分割は
それらの公開APIを変えないため影響しない見込み。実行して確認する。

完了時、各モジュールの責務一覧をタスクメモへ--append-notesで記録する（AC#1）。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
各モジュールの責務一覧（commit 41f38dd4、task/448.2、feat/work-managementから分岐）:

model hook（client/src/features/library/model/）:
- useLibrarySmartFolderEditor(nav, activeSmartFolder): スマートフォルダー編集
  モーダルの開閉state・保存/削除mutation・保存/削除成功時のnav.setAxis遷移を集約。
  キャッシュ更新は既存のuseSmartFolderMutation/useSmartFolderDeleteMutation
  （useLibraryQueries.ts）のものをそのまま使い、新しい無効化集合は持たない。
- useLibrarySelectionCleanup({nav, isNoResultsDueToFilter, workDetailError}): 検索/
  フィルタで0件の時・選択中作品が404の時の選択解除2副作用。旧コードのeffect本体・
  依存配列は変更していない。
- useLibraryPreviewActions({selectedWork, rootFolder, onPlay, onResume,
  openWorkDetail, setAppMode}): playingWorkId/playingTrackIndex/isPlaybackActiveの
  atom購読とhandlePlay/handleResume/handleExpand/handleGoToPlayingScreenを集約。
  「選択中作品が再生中か」の判定式（旧コードで2箇所に重複していた
  `selectedWork && playingWorkId === selectedWork.id`）をisSelectedWorkPlayingへ
  統合（判定条件自体は変えていない）。

UIサブコンポーネント（client/src/features/library/ui/）:
- PreviewPaneSlide.tsx: LibraryView内のローカル関数をそのままファイル分割。
- LibraryResultsPane.tsx: LibraryWorksBoundary配下の結果面（バナー・448.1の
  workResultsPropsの組み立て・WorkGrid/WorkListPaneの出し分け・
  PreviewPaneSlideのAnimatePresence）を集約。
- SmartFolderEditorSection.tsx: SmartFolderEditorModalへの配線
  （エラー文言組み立てを含む）をuseLibrarySmartFolderEditorの戻り値から
  描画する形に集約。

LibraryView.tsxに残ったもの: 付随データ取得の呼び出し（useLibrarySupportingQueries
等、既存のまま）・paneKind/showGrid/activeSmartFolderの算出（既存の純関数）・
上記3hookの呼び出しと配線・handleTagClick（5行）・AxisColumn/FilterChipBand/
value-list分岐・LibraryResultsPaneとSmartFolderEditorSectionの呼び出し。
約424行→212行。

navigationの解釈（useLibraryNavigation）は変更していない（TASK-466で作り直し予定
のため新抽象に包み直さず）。

検証: pnpm check・pnpm test（server 860・client 1147、全緑）・pnpm test:smoke
（28件、全緑）。既存テストの期待値・セットアップともに変更なし
（LibraryView/LibraryResultsPane等を直接レンダーする単体テストは無く、
appBodyDockedBarWiring等の間接テストはuseLibraryQueries.tsの関数と
WorkGrid/WorkListPaneをvi.mockしており、それらの公開APIを変えていないため
影響なし）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LibraryViewを model hook（useLibrarySmartFolderEditor / useLibrarySelectionCleanup / useLibraryPreviewActions）と UI（PreviewPaneSlide / LibraryResultsPane / SmartFolderEditorSection）に分割（約424→212行）。navigationはuseLibraryNavigationのまま、作品変更はADR-0028のhook経由。挙動不変、既存テスト無変更。検証: pnpm check・pnpm test・pnpm test:smoke(28件)緑、Sonnetレビューで副作用なし。feat/work-management 41f38dd4。
<!-- SECTION:FINAL_SUMMARY:END -->
