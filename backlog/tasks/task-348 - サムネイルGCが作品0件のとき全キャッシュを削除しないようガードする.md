---
id: TASK-348
title: サムネイルGCを完全なスナップショット構築時のみ実行するようガードする
status: To Do
assignee: []
created_date: '2026-08-17 16:12'
updated_date: '2026-08-17 17:00'
labels: []
dependencies: []
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-08-17のWindowsドッグフーディングで見つかった不具合（事象1）の修正。全mimimilli.jsonがスキーマ不正（formatVersion未付与）でスキャンが registered=0, errors=1433 となった状態でスキャン完了時GCが走り、有効ファイル名集合が空になってサムネイルキャッシュの全.webpが孤児判定で削除された。

設計の不変条件（Codexレビュー反映・コード検証済み）: 「作品・カバーの完全なスナップショットを構築できた場合だけ、破壊的なGC（削除）を実行する」。0件ガードだけでは不十分で、以下の削除経路が現存する:
- listSummaries（workQueryRepository.ts:264-286）はPersistentDataErrorの行をskippedへ除外するため、不正行1件分のサムネイルは正常時でも孤児判定で削除される
- gcThumbnailCache（thumbnailCache.ts:284-293）はカバーのstat失敗時にskippedWorks++で続行し、その作品のサムネイルは保護されない
- scanFinalize.ts:36-38のresolveWithin失敗も同様にcoverEntriesから漏れて削除対象になる

実装方針:
- ガードは server/src/adapters/real/scanFinalize.ts の finalizeScan 内。GC呼び出しだけを条件分岐で囲む（早期return禁止。53行目の catalog.setScanState(LAST_SCAN_TIME_KEY, ...) は必ず実行する）
- スキップ条件: summaries.length === 0、またはlistSummariesのskippedが1件以上
- gcThumbnailCache側: 有効集合構築中にカバーstat失敗が1件でもあれば削除フェーズを実行しない（スナップショット不完全）。resolveWithin失敗も同様に扱う
- ログは scanLogger.warn で理由・件数・キャッシュディレクトリを出す
- 並行更新（一覧取得後の作品更新）との排他は本タスクの範囲外。残る場合はタスクノートに明記する

関連: server/src/adapters/real/thumbnailCache.ts:275-324、server/tests/real/thumbnailGc.test.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 catalogの作品が0件、またはlistSummariesでskippedされた作品が1件以上あるスキャン完了時、サムネイルの削除が行われない
- [x] #2 有効集合構築中にカバーのstat失敗・resolveWithin失敗が1件でもあった場合、その回の削除フェーズが実行されない
- [x] #3 GCをスキップした場合でもスキャン完了時刻（LAST_SCAN_TIME_KEY）は更新される
- [x] #4 スキップ時に理由・件数・キャッシュディレクトリを含むwarnログが出る
- [x] #5 正常時（完全なスナップショット構築成功時）の孤児.webp・孤児.tmp-削除の既存挙動は維持され、既存のGCテストが通る
- [x] #6 空のcatalog＋既存キャッシュから開始し、全件メタ不正スキャン直後・メタ修正後の再スキャン後ともキャッシュが残ることを検証するテストを追加する
- [x] #7 作品あり・全作品カバーなし（正常な空coverEntries）の場合はGCが実行されることをテストで確認する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
一覧取得後に作品が更新される場合の並行更新との排他は本タスクの範囲外。
<!-- SECTION:NOTES:END -->
