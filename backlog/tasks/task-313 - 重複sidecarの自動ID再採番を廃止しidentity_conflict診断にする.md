---
id: TASK-313
title: 重複sidecarの自動ID再採番を廃止しidentity_conflict診断にする
status: To Do
assignee: []
created_date: '2026-08-12 11:29'
labels: []
dependencies:
  - TASK-310
priority: high
ordinal: 323000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー優先改善3の一部（2026-08-12決定: 自動再採番の廃止）。現状のduplicateMetaIdRepair.tsは同一Work IDのsidecarをパスの自然順で処理し、後から来た側のIDをUUID再採番してsidecarへ書き戻す。コピー先のパスが辞書順で先に来ると元作品のidentityが奪われる危険が実在する。scanは正本（sidecar）を自動変更せず、identity_conflictとして診断記録に残すだけにする。競合作品はcatalog上で識別可能な状態にし、解決UI（別作品として取り込む操作）は別タスク。なおTASK-289で対応した同一メタ内のPlaylist/Track ID重複修復は対象外（Work配下のローカルidentityであり危険性が異なる）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scanが重複Work IDを検出してもsidecarのIDを書き換えない
- [ ] #2 重複はidentity_conflictとして診断に記録され、サーバーAPIから参照できる
- [ ] #3 競合中の作品がcatalogでどう扱われるか（どちらを表示するか等）がADRの仕様どおりに実装されている
- [ ] #4 duplicateMetaIdRepairの自動書き換えテストが新仕様のテストに置き換えられている
<!-- AC:END -->
