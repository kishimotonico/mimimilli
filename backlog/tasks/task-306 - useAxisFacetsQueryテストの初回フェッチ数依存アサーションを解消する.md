---
id: TASK-306
title: useAxisFacetsQueryテストの初回フェッチ数依存アサーションを解消する
status: To Do
assignee: []
created_date: '2026-08-11 10:09'
labels: []
dependencies: []
ordinal: 316000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-228でsmartFolderWorksPaging.test.tsのフレーキーを解消した際、client/tests/unit/useAxisFacetsQuery.test.ts:88-99 に同じ構造が残っていることが分かった。初回マウント直後にaxesの累計フェッチ数を即座に1と断定し、rerender後は累計2と数えている。負荷下でフェッチ記録とisSuccessのタイミングがずれると同種のフレーキーになりうる。TASK-228と同じく、初回フェッチ完了を待ってmockClearし、rerenderで発生する1回のフェッチだけを検証する形へ揃える。現時点で失敗は観測されていない予防的対応。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 useAxisFacetsQuery.test.tsが初回マウント時の累計フェッチ数に依存しない形になっている
- [ ] #2 検証対象（rerender後に新しいクエリキーでフェッチし直すこと）が従来と同等以上に保たれている
- [ ] #3 client側テストが通る
<!-- AC:END -->
