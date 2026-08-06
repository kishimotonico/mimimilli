---
id: TASK-209
title: createRealAdapterを関心事ごとのファクトリへ分割する
status: To Do
assignee: []
created_date: '2026-08-06 04:58'
labels: []
dependencies: []
priority: medium
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/index.ts:242-1240 の createRealAdapter が約1000行の単一関数として DataAdapter の全メソッドをクロージャで実装しており、アダプタ層の分割が最後までやりきられていない唯一のモノリスの残骸になっている。

DLsite（dlsite.ts / dlsiteCache.ts / dlsiteScheduler.ts）、サムネイル（thumbnailCache.ts）、スキャン（scanner.ts）、タグprefix候補生成（tagPrefixCandidates.ts）、作品登録（workRegister.ts）、DBアクセス（workRepo.ts）は既に個別ファイル・クラスへ分離されている。残っているのは、それらを DataAdapter のメソッドとして接着する層だけ。

問題:
- DB初期化・DLsiteスケジューラ配線・サムネイルキャッシュ・カバー計測・スキャンジョブ・タグprefix・スマートフォルダー・作品CRUD・resume という関心事の異なる処理が、同一関数スコープの変数とクロージャで絡み合っている
- 個々のメソッドが暗黙に共有する依存（repo / scanner / dlsiteScheduler / thumbnailCache 等）がシグネチャから読み取れない
- メソッド単位の単体テストが書けず、createRealAdapter を丸ごと起動するしかない（server/tests/real/ の多くが WorkRepo を直接テストしているのはこのため）
- ライブラリ再設計に伴う DataAdapter へのメソッド追加が続いており、このまま伸び続ける

## 方針

関心事ごとにファクトリ関数を切り出し（createCoverMethods(deps) / createScanMethods(deps) / createTagPrefixMethods(deps) / createDlsiteMethods(deps) など）、createRealAdapter はそれらを合成するだけの薄い関数にする。依存は引数として明示し、クロージャ経由の暗黙共有をやめる。

ロジックの変更を伴わない機械的な抽出であり危険な変更ではないが、1000行の移動は差分が大きくレビューコストが高い。関心事ごとに複数PRへ分けて進めるのが妥当（DLsite関連メソッド群で1PR、カバー/サムネイル関連で1PR、というように）。

判断の基準: 実装コストや分量を理由に見送らないこと。分割してでも進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createRealAdapter が関心事ごとのファクトリ関数を合成するだけの薄い関数になっている
- [ ] #2 各ファクトリの依存が引数として明示され、クロージャ経由の暗黙共有に頼っていない
- [ ] #3 分割後のファクトリ単位で単体テストが書ける構造になっており、少なくとも1つの関心事について createRealAdapter 全体を起動しないテストが追加されている
- [ ] #4 抽出の過程で挙動が変わっていない（既存の server テストと契約テストが通る）
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
