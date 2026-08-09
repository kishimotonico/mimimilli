---
id: TASK-270
title: scannerをフェーズ別に分割しメタ書込責務を整理する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
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
- :334-378 UpsertBatch の手動バッチが workRepo.upsertWork と同等 → バッチAPIをworkRepo側へ移して利用
- :246-313 generateフェーズの同期I/O（readdirSync）をasync化またはwalk結果の再利用に変更
- トラックprobe+duration解決ループが scanner と workRepo:423-437 で重複 → probe.ts に共有（検証はscanner専用層に残す）
metaIdMigration呼び出し部はTASK-261の完了形（軽量重複ガード）を前提とする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scan() と registerMetaFile がフェーズ・責務別の関数に分割されていること
- [ ] #2 メタファイル書込が meta.ts 系に集約され、スキャナ本体は読取+DB更新に限定されていること
- [ ] #3 MetaFile組立・coverSatisfied・probe解決の重複が解消されていること
- [ ] #4 generateフェーズにイベントループを塞ぐ同期I/Oが残っていないこと
- [ ] #5 serverテストが通ること
<!-- AC:END -->
