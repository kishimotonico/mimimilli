---
id: TASK-268
title: clientのデッドコード・未使用exportを一括削除する
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
labels: []
dependencies: []
priority: medium
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した確実なデッドコード群。
API/model: entities/work/api.ts の queryDlsiteParseFailedNotifications(:53-58)・listWorkFiles(:96-98)、features/scan/model.ts:14-19 SCAN_PHASE_ORDER、playbackQueueEnded の空ハンドラ（usePlayer.ts:131-132 / playerController.ts:150,343 のコマンド型とemitごと削除）、features/settings/api.ts:17-25 getRootFolder/getLastScanTime（テストのみ）、features/settings/model.ts:2 SettingsUpdate re-export、usePlayer.ts:21-25 formatTime等のre-export、features/files/api.ts:48 未使用re-export、features/library/api.ts:32 WorksQueryParams エイリアス、workPatchMutations.ts（型エイリアスのみのファイル）、LibraryNavigationProvider.tsx（re-exportのみ）、axisValueSort.ts:49-58 getNameKey注入（DRAFT-49着手まで削除）、features/library/model/atoms.ts:14 の冗長importパス
UI/CSS: shared/api/http.ts:75-76 @deprecated GetOptions、styles/tokens.css:71-88 未参照アクセントクラス、Icon.tsx の I.home/I.panelR、Toast.tsx:12-13 actionLabel/onAction（テストのみ）
その他: scripts/spike/logtape-file-sink/ の残置ディレクトリ（node_modules含む3000+ファイル。スパイクはTASK-168/169完了済みのため削除）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 上記の未使用export・ファイル・CSSクラスが削除され、依存テストが整理されていること
- [ ] #2 scripts/spike/logtape-file-sink が削除されていること
- [ ] #3 clientのcheck・変更範囲のテストが通ること
<!-- AC:END -->
