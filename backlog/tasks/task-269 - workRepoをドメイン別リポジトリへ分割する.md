---
id: TASK-269
title: workRepoをドメイン別リポジトリへ分割する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
labels: []
dependencies: []
priority: high
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapters/real/workRepo.ts（1843行）がCRUD・検索SQL・軸ファセット・DLsite通知・スマートフォルダー候補・resume・probeキャッシュを1クラスに抱える god object。目指す最終形はドメイン別分割:
- 行マッピングを workRowMapping.ts、タグEXISTS等のSQLフラグメント生成を workQuerySql.ts へ抽出（RJ正規化のSQL CASE↔TS normalizeRjCode の二重管理もフラグメント生成関数で一本化）
- dlsite通知・axisFacets・resume等をドメイン別repoへ分割（公開面は必要ならfacadeで維持）
あわせて解消する内部問題:
- workRepo.ts:49-50 が adapter.ts から InvalidResumeError・AxisFacetsFilter をimport（永続化層→アダプタ境界の逆依存）→ 型・例外を適切な層へ
- :1283-1296/:1351-1364 getWork と getWorkByPhysicalPath の同一パイプライン重複を集約
- :423-437 liveFileProbeMap のファイルI/OをDB専任のrepoから分離
- :963-977/:1007-1016 DLsite通知CASE式の重複を共有化
- :454ほか3箇所のIN chunk(900)をヘルパ化し、未chunkの circleNameMap も統一
- :1294前後 getWork読込時の syncTotalDurationSec によるDB書込副作用を排除し、同期はスキャン/書込時へ寄せる
worksQueryContract.test.ts の同値性契約テストを維持したまま行うこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 workRepo.ts が行マッピング・SQLフラグメント・ドメイン別repoに分割され、1ファイル1責務になっていること
- [ ] #2 永続化層から adapter.ts へのimportが消えていること
- [ ] #3 getWorkの読み取りにDB書込副作用がないこと
- [ ] #4 IN chunk・通知CASE・getWork系パイプラインの重複が解消されていること
- [ ] #5 worksQueryContract.test.ts を含むserverテストが通ること
<!-- AC:END -->
