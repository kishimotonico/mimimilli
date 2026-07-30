---
id: TASK-129
title: HANDOFFのscan API・worksページング記述を実装に同期する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:28'
updated_date: '2026-07-30 15:40'
labels: []
dependencies: []
priority: medium
ordinal: 139000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
HANDOFF.mdのAPI契約表とARCHITECTURE.mdの主要データフロー節が、scan APIとworksの既定ページングについて実装と乖離している。docsは正典として扱われるため、実装に合わせて更新する。

乖離の内容:
- docs/HANDOFF.md:71-72 は「POST /scan は同期実行（完了までブロックしScanResultを返す）」「GET /scan/events」と記載。実装は server/src/routes/scan.ts:44 で202+Locationを即返すジョブAPIで、エンドポイントは /scan/active・/scan/last・/scan/:id・DELETE /scan/:id・/scan/:id/events（TASK-56で移行済み、client/src/features/scan/api.ts もジョブ契約に依存）
- docs/HANDOFF.md:73 は「page/limit省略時は全件」と記載。実装は shared/src/api.ts:11 の WORKS_DEFAULT_PAGE_SIZE=200 を server/src/routes/works.ts:29・smartFolders.ts:54 が適用（TASK-73で導入済み）
- docs/ARCHITECTURE.md:58 のスキャン節も同期実行前提の記述

コード側の修正は不要（実装が正）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HANDOFF.mdのAPI契約表がscanのジョブAPI（202+Location・active/last/:id/:id/events）を正しく記載している
- [x] #2 HANDOFF.md・ARCHITECTURE.mdからworks省略時全件・同期scanの記述が消え、既定limit=200とSSE再接続の実挙動が記載されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. HANDOFF.mdのAPI表のscan行をジョブAPIへ更新
2. works省略時全件の記述を既定limit=200へ修正
3. ARCHITECTURE.mdのスキャン節を非同期ジョブ+SSE再接続の実挙動へ更新
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。scan表のイベント名(reset/state/progress/completed/failed/cancelled)・ping15秒・204/409・cancelling遷移をrouteとscanJobManager実装で裏取り済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
HANDOFFのAPI表をジョブベースscan API（202+Location、active/last/:id/:id/events、SSEイベント種別）へ更新し、worksの省略時挙動をpage=1,limit=200へ修正。ARCHITECTUREのスキャン節も非同期ジョブ+SSE再接続の実挙動へ書き換えた。実装との一致をrgで検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
