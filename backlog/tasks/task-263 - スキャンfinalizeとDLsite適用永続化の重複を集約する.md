---
id: TASK-263
title: スキャンfinalizeとDLsite適用永続化の重複を集約する
status: To Do
assignee: []
created_date: '2026-08-08 21:17'
labels: []
dependencies: []
priority: medium
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出したreal adapter内の同型処理。
- サムネイルGC + listSummaries + setScanState の終了処理が settingsScanMethods.ts:126-150 と scanWorker.ts:70-95 でほぼ同一 → finalizeScan({repo, thumbnailCacheDir, signal}) として抽出
- DLsite適用の永続化（patch構築 + setDlsiteState + patchMetaFile + db.transaction）が dlsiteMethods.ts:361-416 と 592-628 で同型、類似の三連が計4箇所 → persistDlsiteApply(workId, ...) に集約
- workRegister.ts:217-244 の手動登録時DLsite適用も別実装でタグdedupeが不一致 → 同経路へ統一（挙動差は要確認。差があれば統括へ報告して仕様を確定する）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン終了処理が1つの関数に集約され、memory/worker両経路がそれを使うこと
- [ ] #2 DLsite適用の永続化が1経路に集約され、単発適用・一括適用・手動登録が同じ関数を通ること
- [ ] #3 タグdedupe等の挙動差は統一後の仕様がテストで固定されていること
- [ ] #4 変更範囲のserverテストが通ること
<!-- AC:END -->
