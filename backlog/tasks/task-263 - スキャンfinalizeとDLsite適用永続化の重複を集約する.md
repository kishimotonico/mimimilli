---
id: TASK-263
title: スキャンfinalizeとDLsite適用永続化の重複を集約する
status: Done
assignee: []
created_date: '2026-08-08 21:17'
updated_date: '2026-08-09 10:25'
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
- [x] #1 スキャン終了処理が1つの関数に集約され、memory/worker両経路がそれを使うこと
- [x] #2 変更範囲のserverテストが通ること
- [x] #3 DLsite適用の永続化プリミティブが1実装になり、単発適用・一括適用がそれを使うこと（手動登録は共有できる範囲でプリミティブを利用し、初期化ロジックは独立のまま）
- [x] #4 title・cover・cacheの扱いの仕様差がテストで固定されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
finalizeScan は scanFinalize.ts へ抽出し、settingsScanMethods と scanWorker の2経路が使う。scanWorker 側は cancelled(token) による break から throwIfCancelled の例外方式へ変わったが、同じ try/catch で捕捉され terminal={type:'cancelled'} に落ちるため観測結果は同一。統合の副作用として、サムネイルGCの警告ログが scanWorker 経路でも出るようになった（変更前は settingsScanMethods 経路のみ）。実害はなく両経路の観測性が揃う方向のため許容。DLsite適用は persistDlsiteAppliedWork として「完成済みpatchをDBとメタへ書くプリミティブ」までを共通化し、トランザクション内の順序（patchWorkCatalog→setDlsiteState→patchMetaFile）は元と同一。patch構築と新規work初期化は各層に残し、workRegister.ts は独立のまま。AC#3の「手動登録は共有できる範囲でプリミティブを利用」は、初期化ロジックが独立のため共有可能な範囲が実質なかった。検証: pnpm check 成功、server 531 pass / 0 fail。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャン終了処理を scanFinalize.ts の finalizeScan へ集約し memory/worker 両経路が使う形にした。DLsite適用の永続化は dlsitePersist.ts のプリミティブへ集約し、patch構築と新規work初期化は各層に残した。title・cover・cache の仕様差は dlsiteApplyPersistence.test.ts で固定。pnpm check と server 531 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
