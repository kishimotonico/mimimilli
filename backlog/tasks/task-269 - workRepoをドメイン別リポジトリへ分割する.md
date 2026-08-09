---
id: TASK-269
title: workRepoをドメイン別リポジトリへ分割する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 00:32'
labels: []
dependencies: []
priority: high
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapters/real/workRepo.ts（1843行）がCRUD・検索SQL・軸ファセット・DLsite通知・スマートフォルダー候補・resume・probeキャッシュを1クラスに抱える god object。
Codexレビュー反映（分割軸）: HTTPエンドポイント別の細かいrepo分割はJOIN・トランザクション境界を散らすため採らない。分割は永続化所有権を基本とする: WorkQueryRepository（検索・ファセット等の読取SQL）/ CatalogWorkRepository（catalog書込）/ UserWorkStateRepository(user書込) 程度を基本に、行マッピング（workRowMapping.ts）とSQLフラグメント生成（workQuerySql.ts。タグEXISTS・RJ正規化CASEの一本化）を抽出する。DLsite通知・facetは独立repoにせずquery側の用途別モジュールとする。
あわせて解消する内部問題:
- workRepo.ts:49-50 が adapter.ts から InvalidResumeError・AxisFacetsFilter をimport（永続化層→アダプタ境界の逆依存）→ 型・例外を適切な層へ
- :1283-1296/:1351-1364 getWork と getWorkByPhysicalPath の同一パイプライン重複を集約
- :423-437 liveFileProbeMap のファイルI/OをDB専任のrepoから分離
- :963-977/:1007-1016 DLsite通知CASE式、:454ほかのIN chunk(900)をヘルパ化（未chunkの circleNameMap も統一）
- :1650-1655 countByStatus の全行fetch→COUNT(*)化（TASK-260から移管）
- getWork読込時の syncTotalDurationSec によるDB書込副作用: Codexレビュー反映により「音声差替え後に詳細取得でprobe結果がDBへ同期され一覧にも反映される」鮮度仕様が trackDuration.test.ts:350-363 でテスト済みと判明。仕様を無断で壊さず、先に鮮度仕様を統括と決定する（推奨: 明示的なrefresh/probeコマンドで一括更新し、getWorkは純粋読取へ）
worksQueryContract.test.ts の同値性契約テストを維持したまま行うこと。TASK-273（ADR適合監査）の後に実施する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 workRepo.ts が行マッピング・SQLフラグメント・ドメイン別repoに分割され、1ファイル1責務になっていること
- [ ] #2 永続化層から adapter.ts へのimportが消えていること
- [ ] #3 IN chunk・通知CASE・getWork系パイプラインの重複が解消されていること
- [ ] #4 worksQueryContract.test.ts を含むserverテストが通ること
- [ ] #5 probe鮮度の仕様（音声差替え後の反映タイミング）が決定・文書化され、getWorkの読み取りが副作用なし・更新は明示的経路になっていること
- [ ] #6 countByStatus が COUNT(*) クエリになっていること
<!-- AC:END -->
