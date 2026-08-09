---
id: TASK-270
title: scannerをフェーズ別に分割しメタ書込責務を整理する
status: Done
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 10:34'
labels: []
dependencies:
  - TASK-261
priority: medium
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapters/real/scanner.ts（1072行）の構造整理。
- scan()（:446-664, 約220行）を walk→register→generate→finalize のフェーズ別privateメソッドへ分割
- registerMetaFile（:809-947, 約140行）を probe解決・検証・Work組立に分割
- :966-978/:1054-1069 registerFolderWork と generateMetaForFolder のMetaFile組立重複を共有化
- :684-687/:708-709 coverSatisfied判定のコピペを関数化
- :896-900 スキャナがRJ検出時に patchMetaFile でメタ書込している責務混在を meta.ts 側へ移す
- Codexレビュー反映: UpsertBatch（:333-378）は取消（add内checkAbort）・件数制御flush・user→catalog分離トランザクションを束ねるscan用unit-of-workであり、workRepo.upsertWork への単純移管ではこの3機能が失われる。repoへは移さず、scanUpsertBatch.ts 等scanner隣接のapplication serviceとして抽出する
- Codexレビュー反映: 通常scanはWorker内で動くため「同期I/Oがイベントループを塞ぐ」は主目的にならない。generateフェーズ（:246-313）の目的は「walk結果を再利用して追加のディレクトリ走査をなくす」に修正する
- トラックprobe+duration解決ループが scanner と workRepo:423-437 で重複 → probe.ts に共有（検証はscanner専用層に残す）
metaIdMigration呼び出し部はTASK-261の完了形（軽量重複ガード）を前提とする。repo境界を決めるTASK-269の後に実施する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scan() と registerMetaFile がフェーズ・責務別の関数に分割されていること
- [x] #2 メタファイル書込が meta.ts 系に集約され、スキャナ本体は読取+DB更新に限定されていること
- [x] #3 MetaFile組立・coverSatisfied・probe解決の重複が解消されていること
- [x] #4 serverテストが通ること
- [x] #5 generateフェーズが追加のディレクトリ走査をせずwalk結果を再利用していること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
scanner.ts 1072行→502行。scanWalk.ts(171)・scanRegister.ts(370)・scanUpsertBatch.ts(69)・scanTypes.ts(56)・scanAudio.ts・scanMetaDraft.ts へ分割。checkAbort は walk(scanWalk.ts:80,97)・register(scanRegister.ts:160,265,281,367)・generate(scanner.ts:275,286)・finalize の全フェーズへ貫通。ScanUpsertBatch の3機能（取消・件数制御flush・user→catalog分離トランザクション）は移動前と同一ロジック。RJ検出のメタ書込は meta.ts の syncDetectedRjCode へ移し、書込条件（既存rjCodeがあれば書かない、skip対象作品には触れない）も一致。初回実装で scanner.ts に互換re-exportが残っていたため差し戻して削除し、scannerWorkRoot.test.ts を scanWalk.ts からの直接importへ書き換えた。registerFolderWork・restoreFolderWork が checkAbort にデフォルト無操作を渡す点は分割前と同じで、Worker発の取消トークン経路に乗らない単発同期処理のため問題なし。検証: pnpm check 成功、server 525 pass / 0 fail（単独）。TASK-263 との合流後に並列実行フレーキーが出るが、270投入前でも同頻度以上に発生するため退行ではない（TASK-253へ記録）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scanner.ts を walk→register→generate→finalize のフェーズへ分割し6ファイルへ切り出した。UpsertBatch は scan 用 unit-of-work として scanUpsertBatch.ts へ抽出（repoへは移さない）。RJ検出のメタ書込を meta.ts へ移し、coverSatisfied 判定の重複を scanTypes.ts へ統合。取消の到達性とレガシーメタ不変換を維持。pnpm check と server 525 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
