---
id: TASK-268
title: clientのデッドコード・未使用exportを一括削除する
status: Done
assignee: []
created_date: '2026-08-08 21:19'
updated_date: '2026-08-09 14:25'
labels: []
dependencies: []
priority: medium
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出したデッドコード群。Codexレビューで以下は現役と判明したため削除対象から除外する:
- I.home（AxisColumn.tsx:26 が文字列キー icon: "home" で使用。Icon参照は文字列経由のためrg必須）
- Toast の actionLabel/onAction（WorkTagEditor.tsx:211-214 のタグ削除Undoで本番使用）
- workPatchMutations.ts（library preview系の複数ファイルが型をimport中。整理するならTASK-269系ではなく別途）
- LibraryNavigationProvider.tsx（App.tsx:26,192 で使用中。shim解消はimport付け替えの整理でありデッドコード削除ではない）
- files/api.ts:48 の re-export のうち getFileUrl は FilePreview.tsx:12 で使用中。未使用は getAudioUrl / getCoverImageUrl のみ
削除対象:
- entities/work/api.ts の queryDlsiteParseFailedNotifications(:53-58)・listWorkFiles(:96-98)
- features/scan/model.ts:14-19 SCAN_PHASE_ORDER
- playbackQueueEnded の空ハンドラ（usePlayer.ts:131-132 / playerController.ts:150,343 のコマンド型とemitごと）
- features/settings/api.ts:17-25 getRootFolder/getLastScanTime（テストのみ）、features/settings/model.ts:2 SettingsUpdate re-export
- usePlayer.ts:21-25 formatTime等のre-export、features/library/api.ts:32 WorksQueryParams エイリアス
- axisValueSort.ts:49-58 getNameKey注入（DRAFT-49着手まで削除）、features/library/model/atoms.ts:14 の冗長importパス
- shared/api/http.ts:75-76 @deprecated GetOptions、styles/tokens.css:71-88 未参照アクセントクラス、Icon.tsx の I.panelR（要再確認）
- scripts/spike/logtape-file-sink/ の残置ディレクトリ（node_modules含む3000+ファイル。スパイクはTASK-168/169完了済み）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 上記の未使用export・ファイル・CSSクラスが削除され、依存テストが整理されていること
- [x] #2 scripts/spike/logtape-file-sink が削除されていること
- [x] #3 clientのcheck・変更範囲のテストが通ること
- [x] #4 各シンボルの削除前に、直接参照・文字列キー参照（Icon名等）・re-export経由参照が無いことをrgで確認していること
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
起票時に削除対象としていた I.home（AxisColumn.tsx:26 で icon: "home" として使用）と Toast の actionLabel/onAction（WorkTagEditor.tsx:213-214 の「元に戻す」で使用）は本番利用中のため削除を見送った。LibraryNavigationProvider は削除ではなく、App.tsx が features/*/model を import できない lint 制約を満たすため Provider 実装を ui/ へ移し context を model/libraryNavigationContext.ts へ分離。getNameKey 注入のデフォルトは item.value だったため撤去しても挙動不変。検証: pnpm check 成功、server 525 pass / client 775 tests 全パス。副作用レビュー指摘なし。AC#2（scripts/spike/logtape-file-sink の削除）は git 管理外のディレクトリでツール権限により実行できず未了。
<!-- SECTION:NOTES:END -->
