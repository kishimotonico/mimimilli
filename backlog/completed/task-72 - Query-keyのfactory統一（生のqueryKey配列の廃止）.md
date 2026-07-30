---
id: TASK-72
title: Query keyのfactory統一（生のqueryKey配列の廃止）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 04:07'
updated_date: '2026-07-19 04:40'
labels: []
dependencies: []
modified_files:
  - client/src/entities/work/queryKeys.ts
  - client/src/entities/smart-folder/queryKeys.ts
  - client/src/entities/settings/queryKeys.ts
  - client/src/entities/tag/queryKeys.ts
  - client/src/entities/file-system/queryKeys.ts
  - client/src/app/App.tsx
  - client/src/features/files/ui/FilesView.tsx
  - client/src/features/library/model/dlsiteFetchFailed.ts
  - client/src/features/library/model/dlsiteInvalidation.ts
  - client/src/features/library/model/dlsiteMissingRjCode.ts
  - client/src/features/library/model/dlsiteUnlinked.ts
  - client/src/features/library/model/queryKeys.ts
  - client/src/features/library/model/useLibraryQueries.ts
  - client/src/features/library/ui/preview/DlsiteEditor.tsx
  - client/src/features/player/model/usePlayer.ts
  - client/src/features/settings/ui/TagPrefixSettings.tsx
  - client/tests/unit/usePlayer.test.ts
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(doc-1)指摘18,19の前倒し分（DRAFT-29から独立、優先順位レビューの推奨）。App.tsx等に生のQuery key（["works"]等）が散在し、player→libraryのLIBRARY_KEYS参照など依存方向も乱れている。

対応: Query key factoryをwork entity側（client/src/entities/work/）へ移し、全invalidateQueries/setQueryDataをfactory経由に統一。feature間のkey参照はentity経由になるよう整理する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 生のQuery key配列の直書きが排除され、全てfactory経由になっている
- [x] #2 Query key factoryがentities側にあり、features間の直接参照が解消されている
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. client/src内のqueryKey・invalidateQueries・setQueryDataを全件調査し、既存キー構造とプレフィックスを記録する。
2. work、smart-folder、settings、tag、file-systemの各entityに素朴なas const factoryを配置し、LIBRARY_KEYS・FILES_KEYS・SETTINGS_KEYを置き換える。
3. 生のQuery key配列とQuery key由来のfeature間importが残っていないことをrgで確認し、既存テストはimportパスだけ更新する。
4. pnpm checkとpnpm testを実行し、受け入れ条件・完了サマリー・ステータスをBacklog CLIで更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Query keyをwork、smart-folder、settings、tag、file-systemの5 entity factoryへ分割した。既存の配列形状とプレフィックスは維持している。scanは独自のQuery cacheを持たないためfactory追加対象はなく、スキャン完了時のinvalidationを各entity factory経由へ変更した。既存テストの変更はclient/tests/unit/usePlayer.test.tsのimportパスとfactory名のみ。

検証: pnpm check成功。pnpm test成功（server 21 tests、client 33 files / 243 tests）。rgによるclient/src内の生queryKey配列、旧LIBRARY_KEYS・FILES_KEYS・SETTINGS_KEY参照はいずれも0件。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Query keyを5つのentity factoryへ移設し、query・cache更新・invalidationをすべてfactory経由に統一した。player→libraryおよびsettings→libraryのQuery key依存を解消し、キー構造とinvalidation範囲は維持した。pnpm checkとpnpm testは成功。
<!-- SECTION:FINAL_SUMMARY:END -->
