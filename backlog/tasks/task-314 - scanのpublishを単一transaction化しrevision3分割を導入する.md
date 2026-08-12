---
id: TASK-314
title: scanのpublishを単一transaction化しrevision3分割を導入する
status: To Do
assignee: []
created_date: '2026-08-12 11:30'
labels: []
dependencies:
  - TASK-310
  - TASK-311
priority: medium
ordinal: 324000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー優先改善4・5のserver側部分。現状はScanUpsertBatchが500件ごとに公開catalogへ即commitし、キャンセル・失敗時に新旧世代が混在する。missing確定は最後のfinalizePhaseのみ。I/Oとparse（JSON検証・media stat・duration probe）はtransaction外のstagingで行い、完成した差分だけを短いtransactionで公開する。読み取れなかったsubtreeはmissingへ落とさずunverifiedとして旧投影を維持し、scan中にsidecarが変わった作品は今回のpublishから外す。fingerprintはADRのrevision3分割（source/projection/media、locationは独立観測値）に置き換える。スコープ外: 自動登録の見直し（TASK-166）、Review UI、scan後のDLsite自動連鎖は現状維持（2026-08-12決定）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scanの公開catalog反映が世代単位の短いtransactionで行われ、500件ごとの逐次commitが廃止されている
- [ ] #2 scanのキャンセル・失敗時に公開catalogへ新世代が部分反映されない
- [ ] #3 読み取れなかったsubtreeの作品がmissingにならずunverifiedとして旧投影を維持する
- [ ] #4 fingerprintがsource_revision/projection_revision/media_revisionへ分割され、locationがrevisionに含まれない
- [ ] #5 scan完了後のDLsite自動取得連鎖が従来どおり動作する
- [ ] #6 キャンセル・途中失敗・unverified・移動検知のテストがある
<!-- AC:END -->
