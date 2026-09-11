---
id: TASK-447.16
title: スマートフォルダーの件数プレビューと条件付きファセットのキャッシュ無効化の漏れを直す
status: Done
assignee: []
created_date: '2026-09-11 05:35'
updated_date: '2026-09-11 05:59'
labels:
  - bug
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 484000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー第2回（tmp/uiux-triage-2026-09-11/followup-2.md の B）。SMART_FOLDER_QUERY_KEYS.preview(rules) が allWorks 配下に無く、スキャン・登録・解除の無効化から漏れる。useAxisFacetsQuery の smartFolderId 付きファセットは axisFacets 配下だが、フォルダー保存時は smartFolderWorks しか無効化されない。キー階層が「何に依存しているか」を表すように直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダーエディタの件数プレビューのキャッシュが、スキャン・登録・解除による作品の増減で無効化される
- [x] #2 スマートフォルダーの作成・更新・削除で、そのフォルダー条件付きのファセットのキャッシュが無効化される
- [x] #3 採ったキー階層の方針（どちらの配下に置いたか、理由）がタスクメモにある
- [x] #4 無効化の漏れを再現するテストが追加され、修正前に落ち修正後に通る
- [x] #5 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
キー方針: preview() を ["smartFolderWorks","preview",rules] へ移し allWorks 配下に統合（スキャン/登録/解除の無効化を自動適用）。axisFacets の smartFolderId 付きファセットはキー構造自体は現状維持（axis+filterParamsという依存を素直に表しているため）とし、libraryInvalidation.ts に getSmartFolderSaveInvalidationKeys() を追加してフォルダー作成/更新/削除の mutation 成功時に WORK_QUERY_KEYS.allFacets() も無効化する形にした。テスト: client/tests/unit/libraryInvalidation.test.ts を新規追加（修正前は4件とも失敗、修正後は全て成功を確認）。

既存の client/tests/unit/libraryInvalidation.test.ts は上書きせず、既存テスト「作品一覧・軸件数・DLsite通知・スマートフォルダーのキーを含める」を維持したまま新規テストを追記した（期待値の変更なし）。

pnpm check の check-layer-boundaries で features/scan → features/library の sibling import 違反を検出。getSmartFolderSaveInvalidationKeys/invalidateSmartFolderSaveQueries を呼び出し元と同じ features/library/model/smartFolderInvalidation.ts へ移動（別コミット71d5117）。

レビュー指摘対応（コミットc30c9af）: (1) WORK_QUERY_KEYS.allFacets()=["axisFacets"]はprefix一致のため通常facetsまで無効化していた。smartFolderId付きファセットのキーをWORK_QUERY_KEYS.scopedFacets(smartFolderId, axis, filterParams)=["axisFacets","smartFolder",smartFolderId,axis,filterParams]へ変更し、allScopedFacets(smartFolderId)でそのフォルダー分だけprefix無効化するように修正。テストで通常facetsが無効化されないこと・他フォルダーのscoped facetが無効化されないことを追加で縛った。(2) useSmartFolderMutation/useSmartFolderDeleteMutationの無効化処理をinvalidateSmartFolderSaveQueries呼び出しへ統一（getSmartFolderSaveInvalidationKeysの直書きmapを削除）。(3) files-c.cssの.mle-filestage min-widthにFILES_LIST_MIN_WIDTHとの対応コメントを追加。
<!-- SECTION:NOTES:END -->
