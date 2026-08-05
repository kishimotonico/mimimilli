---
id: TASK-199
title: works検索からaxis/axisValueを廃止しフィルタをタグ経路へ一本化する
status: To Do
assignee: []
created_date: '2026-08-05 10:57'
labels: []
dependencies:
  - TASK-198
priority: high
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex による2回目のマージ前レビュー（2026-08-05）の指摘。統括が該当コードを読んで裏取り済み。

## 問題

ADR-0012 §2 は組み込み軸もタグ経路へ統一し、組み込み軸ごとの専用クエリパラメータは設けないと決めている。しかし実装は、クライアントで @year/2024 を axis=year&axisValue=2024 へ再分解して送信しており、旧ドリル時代の契約が HTTP・adapter・core・SQL に残ったままになっている。

- client/src/features/library/model/libraryPresentation.ts の buildTagFilterParams が params.axis / params.axisValue を設定
- shared/src/api.ts の worksQuerySchema が axis / axisValue を持つ
- server/src/adapter.ts の型、server/src/core/worksQuery.ts の filterByAxis、real アダプタの SQL がそれを解釈

結果としてフィルタの正本が「タグ」と「axis/axisValue」の二重になっている。

付随する具体的な問題:

- filterByAxis は axis か axisValue の片方だけが指定されたとき if (!axis || !axisValue) return works で全件へ黙ってフォールバックする（AGENTS.md「過度なフォールバックは禁止」に反する）
- filterByAxis の year 以外の分岐（prefix 軸のタグ完全一致）は、クライアントが axis=year しか送らなくなった現在、到達しないデッド分岐になっている

## 対応方針（統括判断）

互換性は不要なので、公開クエリと adapter から axis / axisValue を削除する。組み込み軸のフィルタはサーバー側の共通フィルタ解釈層で tags 内の @year/... を一度だけ解釈する構成にする。これで ADR-0012 §2 の意図が API 層まで一貫する。

GET /axes/:axis のパス側の axis は「何の値一覧を見ているか」を表すもので、フィルタとは別の概念なのでそのまま残す。

スマートフォルダー評価（TASK-185 で追加した経路）も同じ契約を使っているので、あわせて移行すること。

## リスクと安全網

shared の契約・server・client・スマートフォルダー経路にまたがる変更で、ブランチ終盤の変更としては大きい。ただし real⇔fixture の同値契約テスト（server/tests/real/worksQueryContract.test.ts）とスモークテストが安全網になる。移行後もこれらが通ることを必ず確認すること。

対象: shared/src/api.ts / server/src/adapter.ts / server/src/core/worksQuery.ts / server/src/adapters/real/workRepo.ts / server/src/core/smartFolder.ts / client/src/features/library/model/libraryPresentation.ts / client/src/features/library/api.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 worksQuerySchema と adapter の型から axis / axisValue が削除されている
- [ ] #2 組み込み軸のフィルタがサーバー側で tags 内の擬似タグとして一度だけ解釈される
- [ ] #3 filterByAxis の到達不能だった prefix 軸分岐と、片方のみ指定時の全件フォールバックが無くなっている
- [ ] #4 スマートフォルダー評価も同じ契約で動く
- [ ] #5 real と fixture の同値契約テストが移行後の契約で通る
- [ ] #6 year 軸での絞り込みが従来どおり動作することを実機で確認している
- [ ] #7 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
