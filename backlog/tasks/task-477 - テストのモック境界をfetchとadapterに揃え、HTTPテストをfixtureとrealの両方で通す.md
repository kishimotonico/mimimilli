---
id: TASK-477
title: テストのモック境界をfetchとadapterに揃え、HTTPテストをfixtureとrealの両方で通す
status: To Do
assignee: []
created_date: '2026-10-02 11:40'
labels:
  - test
  - client
  - server
dependencies: []
priority: medium
ordinal: 535000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で、契約を検証できないテストが見つかった。client: entities/*/api をvi.mockで丸ごと差し替えるテスト（DlsiteEditor, WorkEditDialog, usePlayer等）はレスポンスがsharedのZodスキーマを通る保証が無い。propsの通過やrender回数だけを見る配線テスト（appBodyDockedBarWiring, appRootSubscriptions, playerDock*, workPatchMutationScope等）は実装詳細に結合している。getBy*にtoBeTruthy()、length > 0 だけの期待値も残る。setup.tsの global.fetch = vi.fn() は未モック呼び出しを黙ってundefinedにする。server: route/HTTPテスト（app, smartFolderPagination, worksPagination, smartFolderPreviewRoute, tagPrefixes, scanCandidatesRoute）がfixtureのみ。dlsiteProgress.test.ts:10 はDataAdapterを as unknown as の空スタブにしている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 clientのAPIモックがfetch境界で行われ、レスポンスがsharedのスキーマ検証を通るビルダーで作られている
- [ ] #2 未モックのfetch呼び出しがテストを失敗させる
- [ ] #3 serverの主要route/HTTPテストがfixtureとrealの両adapterで同じ期待値を通る
- [ ] #4 実装詳細にのみ結合した配線テストと恒真的な期待値が、振る舞いを検証する形に置き換わるか削除されている
- [ ] #5 期待値を緩めた変更が無いことをテスト差分で確認できる
- [ ] #6 pnpm check && pnpm test が通り、所要時間が大きく増えない
<!-- AC:END -->
