---
id: TASK-135
title: デッドコードと到達不能な互換分岐をまとめて削除する
status: To Do
assignee: []
created_date: '2026-07-30 12:31'
labels: []
dependencies: []
priority: medium
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビューで確定した「本番コードから到達しない」削除対象4点（すべて敵対的検証で全域rg済み）。いずれも削除のみで1PRに収まる。

1. client/src/entities/work/api.ts:43 の queryWorks: client全域で参照ゼロ。旧「省略時全件」前提の実装で反復tagsも表現できない。現行検索経路は client/src/features/library/api.ts:44 の searchWorks
2. locateMedia("cover") 経路: server/src/routes/media.ts はcoverに describeCover のみ使用。real/index.ts:817-819・fixture/index.ts:612-616 の kind==="cover" 分岐は到達不能。adapter.ts の locateMedia 契約を audio/file 専用に狭める
3. server/src/adapters/real/probe.ts:21-45 の cache省略時N+1フォールバック: 本番呼び出し元（scanner.ts:717・workRepo.ts:416）は常にcacheを渡す。省略で呼ぶのは resumeV2.test.ts のみ。cacheを必須化しテストも揃える
4. server/src/adapters/real/scanner.ts:353-357 の Scanner.scan() 関数渡し互換分岐: 全呼び出し（scanJobManager経由・scanWorker.ts:56・全テスト）がオブジェクト形かoptions無し。DataAdapter.scan の型（adapter.ts:101）も関数型を宣言していない。分岐と adapter.ts:100 の「旧来のprogress callbackも受け付ける」コメントを削除。tests/scanProgress.test.ts:178 のモック内の同パターン踏襲も掃除
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 上記4点が削除され、locateMediaの契約がaudio/file専用になっている
- [ ] #2 probeのcache引数が必須化され、関連テストが更新されている
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
