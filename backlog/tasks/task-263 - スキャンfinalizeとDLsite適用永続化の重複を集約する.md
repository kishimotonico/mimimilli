---
id: TASK-263
title: スキャンfinalizeとDLsite適用永続化の重複を集約する
status: To Do
assignee: []
created_date: '2026-08-08 21:17'
updated_date: '2026-08-09 00:26'
labels: []
dependencies: []
priority: medium
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出したreal adapter内の同型処理。
- サムネイルGC + listSummaries + setScanState の終了処理が settingsScanMethods.ts:126-150 と scanWorker.ts:70-95 でほぼ同一 → finalizeScan({repo, thumbnailCacheDir, signal}) として抽出
- DLsite適用の永続化（patch構築 + setDlsiteState + patchMetaFile + db.transaction）が dlsiteMethods.ts:361-416 と 592-628 で同型 → 共通化する
Codexレビュー反映:
- 手動登録（workRegister.ts:217-246）と既存作品への適用は永続化ライフサイクルが異なる。共通化は「完成済みpatchをDBとメタへ書くプリミティブ」までとし、新規work初期化と既存work更新は別のapplication serviceに残す
- 「手動登録だけタグdedupeが不一致」という当初の指摘は誤り（HTTP境界のZod変換 normalizedTagInputArraySchema で正規化・dedupe済み）。dedupe統一はACに含めない。実在する仕様差（title・cover・cacheの扱い）をテストで固定する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン終了処理が1つの関数に集約され、memory/worker両経路がそれを使うこと
- [ ] #2 変更範囲のserverテストが通ること
- [ ] #3 DLsite適用の永続化プリミティブが1実装になり、単発適用・一括適用がそれを使うこと（手動登録は共有できる範囲でプリミティブを利用し、初期化ロジックは独立のまま）
- [ ] #4 title・cover・cacheの扱いの仕様差がテストで固定されていること
<!-- AC:END -->
