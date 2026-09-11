---
id: TASK-447.16
title: スマートフォルダーの件数プレビューと条件付きファセットのキャッシュ無効化の漏れを直す
status: To Do
assignee: []
created_date: '2026-09-11 05:35'
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
- [ ] #1 スマートフォルダーエディタの件数プレビューのキャッシュが、スキャン・登録・解除による作品の増減で無効化される
- [ ] #2 スマートフォルダーの作成・更新・削除で、そのフォルダー条件付きのファセットのキャッシュが無効化される
- [ ] #3 採ったキー階層の方針（どちらの配下に置いたか、理由）がタスクメモにある
- [ ] #4 無効化の漏れを再現するテストが追加され、修正前に落ち修正後に通る
- [ ] #5 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->
